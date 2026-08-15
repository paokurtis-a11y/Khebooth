import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryLocalStore } from '../src/offline/memory-store';
import { MemoryCredentialVault } from '../src/security/memory-credential-vault';
import { StationBootstrapService } from '../src/station/station-bootstrap';
import type { MediaTransfer } from '../src/sync/media-transfer';
import { SyntheticMediaTransfer } from '../src/sync/media-transfer';
import { SyncEngine } from '../src/sync/sync-engine';
import { FakeStationApi, TEST_EVENT_ID } from './helpers';

class InterruptingTransfer implements MediaTransfer {
  async transfer(
    media: Parameters<MediaTransfer['transfer']>[0],
    resumeFrom: number,
    onProgress: Parameters<MediaTransfer['transfer']>[2],
  ): Promise<void> {
    assert.equal(resumeFrom, 0);
    await onProgress(Math.floor(media.byteSize / 2));
    throw new Error('simulated network interruption');
  }
}

test('interrupted upload resumes idempotently without deleting local media', async () => {
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

  const firstEngine = new SyncEngine(api, store, vault, new InterruptingTransfer());
  await firstEngine.queueMedia({
    eventId: TEST_EVENT_ID,
    localId: 'local-video-001',
    idempotencyKey: 'event-1:local-video-001:v1',
    contentHash: 'sha256:synthetic-001',
    byteSize: 100,
    mimeType: 'video/mp4',
    localUri: 'file:///documents/khe/local-video-001.mp4',
    capturedAt: '2026-08-15T06:30:00.000Z',
  });

  const first = await firstEngine.drain(new Date('2026-08-15T06:31:00.000Z'));
  assert.deepEqual(first, { attempted: 1, synced: 0, failed: 1 });

  const interrupted = await store.getMedia('local-video-001');
  assert.equal(interrupted?.syncState, 'FAILED');
  assert.equal(interrupted?.uploadedBytes, 50);
  assert.equal(interrupted?.localUri, 'file:///documents/khe/local-video-001.mp4');
  assert.equal((await store.listQueue()).length, 1);

  // Simulates an application/service restart while keeping the same durable store and secure credential.
  const restartedEngine = new SyncEngine(api, store, vault, new SyntheticMediaTransfer());
  const second = await restartedEngine.drain(new Date('2026-08-15T06:31:10.000Z'));
  assert.deepEqual(second, { attempted: 1, synced: 1, failed: 0 });

  const synced = await store.getMedia('local-video-001');
  assert.equal(synced?.syncState, 'SYNCED');
  assert.equal(synced?.uploadedBytes, 100);
  assert.ok(synced?.acknowledgedAt);
  assert.equal(synced?.localUri, 'file:///documents/khe/local-video-001.mp4');
  assert.equal((await store.listQueue()).length, 0);

  // Two retries hit createMedia, but the fake server still owns one logical media record.
  assert.equal(api.createCalls, 2);
  assert.equal(api.mediaByIdempotency.size, 1);
});

test('queuing the same local media is idempotent and rejects conflicting metadata', async () => {
  const api = new FakeStationApi();
  const store = new MemoryLocalStore();
  const vault = new MemoryCredentialVault();
  const engine = new SyncEngine(api, store, vault, new SyntheticMediaTransfer());
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
