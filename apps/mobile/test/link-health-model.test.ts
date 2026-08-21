import assert from 'node:assert/strict';
import test from 'node:test';
import type { MediaAssetContract, StationControlContract } from '@khe/contracts';
import type { LocalMediaRecord, SyncQueueItem } from '../src/offline/types';
import { evaluateLinkHealth, type LinkHealthInput } from '../src/station/link-health-model';

const EVENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NOW = new Date('2026-08-21T06:00:00.000Z');

function control(overrides: Partial<StationControlContract> = {}): StationControlContract {
  return {
    eventId: EVENT_ID,
    command: 'NONE',
    commandVersion: 4,
    acknowledgedVersion: 4,
    runtimeState: 'IDLE',
    selectedEffect: 'NONE',
    maxDurationSeconds: 20,
    elapsedSeconds: 0,
    captureSeenAt: '2026-08-21T05:59:58.000Z',
    sharingConnectionStatus: 'ACCEPTED',
    sharingRequestedAt: '2026-08-21T05:59:50.000Z',
    sharingRespondedAt: '2026-08-21T05:59:51.000Z',
    updatedAt: '2026-08-21T05:59:58.000Z',
    ...overrides,
  };
}

function localMedia(overrides: Partial<LocalMediaRecord> = {}): LocalMediaRecord {
  return {
    localId: 'local-1',
    eventId: EVENT_ID,
    idempotencyKey: 'key-1',
    contentHash: 'sha256:1',
    byteSize: 100,
    mimeType: 'video/mp4',
    localUri: 'file:///local-1.mp4',
    capturedAt: '2026-08-21T05:59:55.000Z',
    syncState: 'QUEUED',
    remoteId: null,
    uploadedBytes: 0,
    acknowledgedAt: null,
    retryCount: 0,
    lastError: null,
    updatedAt: '2026-08-21T05:59:55.000Z',
    ...overrides,
  };
}

function remoteMedia(overrides: Partial<MediaAssetContract> = {}): MediaAssetContract {
  return {
    id: 'remote-1',
    organizationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    eventId: EVENT_ID,
    localId: 'local-cloud-1',
    contentHash: 'sha256:cloud',
    byteSize: 100,
    mimeType: 'video/mp4',
    syncState: 'SYNCED',
    capturedAt: '2026-08-21T05:59:40.000Z',
    acknowledgedAt: '2026-08-21T05:59:45.000Z',
    ...overrides,
  };
}

function base(overrides: Partial<LinkHealthInput> = {}): LinkHealthInput {
  return {
    mode: 'SHARING',
    eventId: EVENT_ID,
    manifestEventId: EVENT_ID,
    networkConnected: true,
    apiReachable: true,
    control: control(),
    localMedia: [] as LocalMediaRecord[],
    queue: [] as SyncQueueItem[],
    remoteMedia: [remoteMedia()],
    checkedAt: NOW,
    ...overrides,
  };
}

test('link health is READY when event, network, heartbeat and authorization are aligned', () => {
  const result = evaluateLinkHealth(base());
  assert.equal(result.level, 'READY');
  assert.equal(result.eventMatches, true);
  assert.equal(result.captureOnline, true);
  assert.equal(result.connectionStatus, 'ACCEPTED');
  assert.equal(result.remoteSyncedMedia, 1);
  assert.equal(result.commandLag, 0);
});

test('link health is SYNCING while recent CAPTURE media is queued', () => {
  const item = localMedia();
  const result = evaluateLinkHealth(base({
    mode: 'CAPTURE',
    localMedia: [item],
    queue: [{ localId: item.localId, nextAttemptAt: NOW.toISOString(), retryCount: 0, lastError: null }],
  }));
  assert.equal(result.level, 'SYNCING');
  assert.equal(result.pendingMedia, 1);
  assert.equal(result.queueItems, 1);
});

test('link health requires attention for stale heartbeat, refused connection or failed media', () => {
  const item = localMedia({
    capturedAt: '2026-08-21T05:55:00.000Z',
    syncState: 'FAILED',
    retryCount: 2,
    lastError: 'network',
  });
  const result = evaluateLinkHealth(base({
    control: control({ captureSeenAt: '2026-08-21T05:59:30.000Z', sharingConnectionStatus: 'REJECTED' }),
    localMedia: [item],
    queue: [{ localId: item.localId, nextAttemptAt: NOW.toISOString(), retryCount: 2, lastError: 'network' }],
  }));
  assert.equal(result.level, 'ATTENTION');
  assert.equal(result.captureOnline, false);
  assert.equal(result.failedMedia, 1);
  assert.ok(result.reasons.some((reason) => reason.includes('refusée')));
});

test('link health is OFFLINE without network or reachable KHE API', () => {
  const result = evaluateLinkHealth(base({ networkConnected: false, apiReachable: false, control: null }));
  assert.equal(result.level, 'OFFLINE');
  assert.equal(result.apiReachable, false);
  assert.ok(result.advice.some((entry) => entry.includes('médias déjà téléchargés')));
});

test('link health flags event mismatch and ignores local queue from another event', () => {
  const old = localMedia({ eventId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', localId: 'old-media' });
  const result = evaluateLinkHealth(base({
    manifestEventId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    localMedia: [old],
    queue: [{ localId: old.localId, nextAttemptAt: NOW.toISOString(), retryCount: 0, lastError: null }],
  }));
  assert.equal(result.level, 'ATTENTION');
  assert.equal(result.eventMatches, false);
  assert.equal(result.pendingMedia, 0);
  assert.equal(result.queueItems, 0);
});
