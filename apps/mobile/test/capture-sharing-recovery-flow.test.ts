import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryLocalStore } from '../src/offline/memory-store';
import { MemoryCredentialVault } from '../src/security/memory-credential-vault';
import { SharingCatalogService } from '../src/sharing/sharing-catalog';
import { StationBootstrapService } from '../src/station/station-bootstrap';
import type { MediaTransfer } from '../src/sync/media-transfer';
import { SyncEngine } from '../src/sync/sync-engine';
import { FakeStationApi, TEST_EVENT_ID } from './helpers';

const FIRST_DRAIN = new Date('2030-01-01T00:00:00.000Z');
const RETRY_DRAIN = new Date('2030-01-01T00:00:10.000Z');

class InterruptOnceTransfer implements MediaTransfer {
  private interrupted = false;

  constructor(private readonly api: FakeStationApi) {}

  async transfer(
    media: Parameters<MediaTransfer['transfer']>[0],
    uploadUrl: string,
    onProgress: Parameters<MediaTransfer['transfer']>[2],
  ): Promise<void> {
    assert.match(uploadUrl, /^https:\/\/blob\.example\.test\//);
    if (!this.interrupted) {
      this.interrupted = true;
      await onProgress(Math.floor(media.byteSize / 2));
      throw new Error('simulated event Wi-Fi interruption');
    }
    await onProgress(media.byteSize);
    if (!media.remoteId) throw new Error('remote media id unavailable');
    this.api.markBlobStored(media.remoteId);
  }
}

test('CAPTURE recovers an interrupted upload and SHARING receives exactly one synchronized media', async () => {
  const api = new FakeStationApi();

  const captureStore = new MemoryLocalStore();
  const captureVault = new MemoryCredentialVault();
  await new StationBootstrapService(api, captureStore, captureVault).redeem({
    eventId: TEST_EVENT_ID,
    code: 'KHE-123456',
    installationId: 'tablet-capture-recovery',
    mode: 'CAPTURE',
  });

  const sharingStore = new MemoryLocalStore();
  const sharingVault = new MemoryCredentialVault();
  await new StationBootstrapService(api, sharingStore, sharingVault).redeem({
    eventId: TEST_EVENT_ID,
    code: 'KHE-654321',
    installationId: 'tablet-sharing-recovery',
    mode: 'SHARING',
  });

  const transfer = new InterruptOnceTransfer(api);
  const sync = new SyncEngine(api, captureStore, captureVault, transfer);
  await sync.queueMedia({
    eventId: TEST_EVENT_ID,
    localId: 'recovery-moment-001',
    idempotencyKey: 'recovery-event:moment-001:v1',
    contentHash: 'sha256:recovery-moment-001',
    byteSize: 200,
    mimeType: 'video/mp4',
    localUri: 'file:///documents/khe/recovery-moment-001.mp4',
    capturedAt: '2026-08-22T04:40:00.000Z',
  });

  assert.deepEqual(await sync.drain(FIRST_DRAIN), { attempted: 1, synced: 0, failed: 1 });
  assert.equal((await captureStore.listQueue()).length, 1);

  api.failListMedia = true;
  const sharing = new SharingCatalogService(api, sharingStore, sharingVault);
  await assert.rejects(() => sharing.refresh(), /network offline/);
  assert.deepEqual(await sharing.cached(), []);

  assert.deepEqual(await sync.drain(RETRY_DRAIN), { attempted: 1, synced: 1, failed: 0 });
  assert.equal((await captureStore.listQueue()).length, 0);
  assert.equal(api.mediaByIdempotency.size, 1, 'retry must not create a duplicate cloud media');

  api.failListMedia = false;
  const received = await sharing.refresh();
  assert.equal(received.length, 1);
  assert.equal(received[0]?.localId, 'recovery-moment-001');
  assert.ok(received[0]?.acknowledgedAt);
  assert.deepEqual(await sharing.cached(), received);
});
