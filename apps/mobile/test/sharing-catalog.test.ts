import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryLocalStore } from '../src/offline/memory-store';
import { MemoryCredentialVault } from '../src/security/memory-credential-vault';
import { SharingCatalogService } from '../src/sharing/sharing-catalog';
import { StationBootstrapService } from '../src/station/station-bootstrap';
import type { MediaTransfer } from '../src/sync/media-transfer';
import { SyncEngine } from '../src/sync/sync-engine';
import { FakeStationApi, TEST_EVENT_ID } from './helpers';

class StoredTransfer implements MediaTransfer {
  constructor(private readonly api: FakeStationApi) {}

  async transfer(
    media: Parameters<MediaTransfer['transfer']>[0],
    _uploadUrl: string,
    onProgress: Parameters<MediaTransfer['transfer']>[2],
  ): Promise<void> {
    await onProgress(media.byteSize);
    if (!media.remoteId) throw new Error('remote id unavailable');
    this.api.markBlobStored(media.remoteId);
  }
}

test('SHARING discovers only server-acknowledged media and keeps an offline cache', async () => {
  const api = new FakeStationApi();

  const captureStore = new MemoryLocalStore();
  const captureVault = new MemoryCredentialVault();
  await new StationBootstrapService(api, captureStore, captureVault).redeem({
    eventId: TEST_EVENT_ID,
    code: 'KHE-123456',
    installationId: 'capture-tablet',
    mode: 'CAPTURE',
  });
  const capture = new SyncEngine(api, captureStore, captureVault, new StoredTransfer(api));
  await capture.queueMedia({
    eventId: TEST_EVENT_ID,
    localId: 'share-me',
    idempotencyKey: 'share-me:v1',
    contentHash: 'sha256:share-me',
    byteSize: 25,
    mimeType: 'video/mp4',
    localUri: 'file:///documents/share-me.mp4',
  });

  const sharingStore = new MemoryLocalStore();
  const sharingVault = new MemoryCredentialVault();
  await new StationBootstrapService(api, sharingStore, sharingVault).redeem({
    eventId: TEST_EVENT_ID,
    code: 'KHE-123456',
    installationId: 'sharing-tablet',
    mode: 'SHARING',
  });
  const sharing = new SharingCatalogService(api, sharingStore, sharingVault);

  assert.deepEqual(await sharing.refresh(), []);

  await capture.drain(new Date('2030-01-01T00:00:00.000Z'));
  const online = await sharing.refresh();
  assert.equal(online.length, 1);
  assert.equal(online[0]?.localId, 'share-me');

  api.failListMedia = true;
  await assert.rejects(() => sharing.refresh(), /network offline/);

  const offline = await sharing.cached();
  assert.equal(offline.length, 1);
  assert.equal(offline[0]?.localId, 'share-me');
  assert.ok(offline[0]?.acknowledgedAt);
});
