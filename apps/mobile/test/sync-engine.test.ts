import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryLocalStore } from '../src/offline/memory-store';
import { MemoryCredentialVault } from '../src/security/memory-credential-vault';
import { StationBootstrapService } from '../src/station/station-bootstrap';
import type { MediaTransfer } from '../src/sync/media-transfer';
import { SyncEngine } from '../src/sync/sync-engine';
import { FakeStationApi, TEST_EVENT_ID } from './helpers';

const DRAIN_AT = new Date('2030-01-01T00:00:00.000Z');
const RETRY_AT = new Date('2030-01-01T00:00:10.000Z');
const OTHER_EVENT_ID = '77777777-7777-4777-8777-777777777777';

class SuccessfulTransfer implements MediaTransfer {
  calls = 0;
  constructor(private readonly api: FakeStationApi) {}

  async transfer(
    media: Parameters<MediaTransfer['transfer']>[0],
    uploadUrl: string,
    onProgress: Parameters<MediaTransfer['transfer']>[2],
  ): Promise<void> {
    this.calls += 1;
    assert.match(uploadUrl, /^https:\/\/blob\.example\.test\//);
    await onProgress(Math.floor(media.byteSize / 2));
    await onProgress(media.byteSize);
    if (!media.remoteId) throw new Error('remote id unavailable');
    this.api.markBlobStored(media.remoteId);
  }
}

class InterruptingTransfer implements MediaTransfer {
  calls = 0;
  async transfer(
    media: Parameters<MediaTransfer['transfer']>[0],
    uploadUrl: string,
    onProgress: Parameters<MediaTransfer['transfer']>[2],
  ): Promise<void> {
    this.calls += 1;
    assert.match(uploadUrl, /^https:\/\/blob\.example\.test\//);
    await onProgress(Math.floor(media.byteSize / 2));
    throw new Error('simulated network interruption');
  }
}

async function activatedContext() {
  const api = new FakeStationApi();
  const store = new MemoryLocalStore();
  const vault = new MemoryCredentialVault();
  const bootstrap = new StationBootstrapService(api, store, vault);
  await bootstrap.redeem({
    eventId: TEST_EVENT_ID,
    code: 'KHE-123456',
    installationId: 'tablet-capture-a',
    mode: 'CAPTURE',
  });
  return { api, store, vault };
}

async function queueVideo(engine: SyncEngine, localId = 'local-video-001') {
  return engine.queueMedia({
    eventId: TEST_EVENT_ID,
    localId,
    idempotencyKey: `event-1:${localId}:v1`,
    contentHash: `sha256:${localId}`,
    byteSize: 100,
    mimeType: 'video/mp4',
    localUri: `file:///documents/khe/${localId}.mp4`,
    capturedAt: '2026-08-15T06:30:00.000Z',
  });
}

test('interrupted signed PUT preserves local media and retries idempotently', async () => {
  const { api, store, vault } = await activatedContext();
  const interruptedTransfer = new InterruptingTransfer();
  const firstEngine = new SyncEngine(api, store, vault, interruptedTransfer);
  await queueVideo(firstEngine);

  const first = await firstEngine.drain(DRAIN_AT);
  assert.deepEqual(first, { attempted: 1, synced: 0, failed: 1 });

  const interrupted = await store.getMedia('local-video-001');
  assert.equal(interrupted?.syncState, 'FAILED');
  assert.equal(interrupted?.uploadedBytes, 50);
  assert.equal(interrupted?.localUri, 'file:///documents/khe/local-video-001.mp4');
  assert.equal((await store.listQueue()).length, 1);
  assert.equal(interruptedTransfer.calls, 1);

  const successfulTransfer = new SuccessfulTransfer(api);
  const restartedEngine = new SyncEngine(api, store, vault, successfulTransfer);
  const second = await restartedEngine.drain(RETRY_AT);
  assert.deepEqual(second, { attempted: 1, synced: 1, failed: 0 });

  const synced = await store.getMedia('local-video-001');
  assert.equal(synced?.syncState, 'SYNCED');
  assert.equal(synced?.uploadedBytes, 100);
  assert.ok(synced?.acknowledgedAt);
  assert.equal(synced?.localUri, 'file:///documents/khe/local-video-001.mp4');
  assert.equal((await store.listQueue()).length, 0);
  assert.equal(successfulTransfer.calls, 1);
  assert.equal(api.createCalls, 2);
  assert.equal(api.mediaByIdempotency.size, 1);
});

test('completed cloud upload is not transferred twice when finalize response is lost', async () => {
  const { api, store, vault } = await activatedContext();
  api.failFinalizeOnce = true;
  const transfer = new SuccessfulTransfer(api);
  const engine = new SyncEngine(api, store, vault, transfer);
  await queueVideo(engine, 'local-video-finalize-loss');

  const first = await engine.drain(DRAIN_AT);
  assert.deepEqual(first, { attempted: 1, synced: 0, failed: 1 });
  assert.equal(transfer.calls, 1);

  const second = await engine.drain(RETRY_AT);
  assert.deepEqual(second, { attempted: 1, synced: 1, failed: 0 });
  assert.equal(transfer.calls, 1, 'existing Blob must skip the second media transfer');
  assert.equal(api.prepareUploadCalls, 2);

  const synced = await store.getMedia('local-video-finalize-loss');
  assert.equal(synced?.syncState, 'SYNCED');
  assert.equal(synced?.uploadedBytes, 100);
  assert.equal((await store.listQueue()).length, 0);
});

test('queuing the same local media is idempotent and rejects conflicting metadata', async () => {
  const { api, store, vault } = await activatedContext();
  const engine = new SyncEngine(api, store, vault, new SuccessfulTransfer(api));
  const input = {
    eventId: TEST_EVENT_ID,
    localId: 'same-local-id',
    idempotencyKey: 'same-key',
    contentHash: 'sha256:same',
    byteSize: 10,
    mimeType: 'video/mp4',
    localUri: 'file:///same.mp4',
  };

  const first = await engine.queueMedia(input);
  const second = await engine.queueMedia(input);
  assert.equal(first.localId, second.localId);
  assert.equal((await store.listQueue()).length, 1);

  await assert.rejects(
    () => engine.queueMedia({ ...input, contentHash: 'sha256:different' }),
    /different media/,
  );
});

test('queued media from another event stays local and is never uploaded with the active station token', async () => {
  const { api, store, vault } = await activatedContext();
  const transfer = new SuccessfulTransfer(api);
  const engine = new SyncEngine(api, store, vault, transfer);
  const localId = 'old-event-video';

  await engine.queueMedia({
    eventId: OTHER_EVENT_ID,
    localId,
    idempotencyKey: `old-event:${localId}:v1`,
    contentHash: `sha256:${localId}`,
    byteSize: 120,
    mimeType: 'video/mp4',
    localUri: `file:///documents/khe/${localId}.mp4`,
    capturedAt: '2026-08-14T18:00:00.000Z',
  });

  const result = await engine.drain(DRAIN_AT);
  assert.deepEqual(result, { attempted: 0, synced: 0, failed: 0 });
  assert.equal(api.createCalls, 0, 'cross-event media must never reach the API');
  assert.equal(transfer.calls, 0);

  const preserved = await store.getMedia(localId);
  assert.equal(preserved?.eventId, OTHER_EVENT_ID);
  assert.equal(preserved?.syncState, 'QUEUED');
  assert.equal(preserved?.retryCount, 0);
  assert.equal(preserved?.localUri, `file:///documents/khe/${localId}.mp4`);
  assert.equal((await store.listQueue()).length, 1, 'old-event queue item must stay pending for its original event');
});
