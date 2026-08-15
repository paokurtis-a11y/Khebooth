import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryLocalStore } from '../src/offline/memory-store';
import { MemoryCredentialVault } from '../src/security/memory-credential-vault';
import { StationBootstrapService } from '../src/station/station-bootstrap';
import { FakeStationApi, TEST_EVENT_ID } from './helpers';

test('activation persists station context and manifest while credential stays in the secure vault', async () => {
  const store = new MemoryLocalStore();
  const vault = new MemoryCredentialVault();
  const api = new FakeStationApi();
  const firstProcess = new StationBootstrapService(api, store, vault);

  await firstProcess.redeem({
    eventId: TEST_EVENT_ID,
    code: 'KHE-123456',
    installationId: 'tablet-capture-a',
    mode: 'CAPTURE',
    deviceName: 'Capture tablet',
    platform: 'ios',
  });

  const restartedProcess = new StationBootstrapService(api, store, vault);
  const station = await restartedProcess.getCachedContext();
  const manifest = await store.getManifest(TEST_EVENT_ID);

  assert.equal(station?.installationId, 'tablet-capture-a');
  assert.equal(station?.mode, 'CAPTURE');
  assert.equal(station ? 'stationToken' in station : false, false);
  assert.equal(await vault.getStationToken(), 'capture-token');
  assert.equal(manifest?.event.id, TEST_EVENT_ID);
  assert.equal(manifest?.mediaPolicy.preserveUnsyncedMedia, true);
  assert.deepEqual(manifest?.capabilities.formats, ['9:16', '1:1']);
});
