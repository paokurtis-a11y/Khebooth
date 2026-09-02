import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryLocalStore } from '../src/offline/memory-store';
import type { CapturePipelineRecord } from '../src/offline/types';
import { CaptureProcessingService, captureIsProcessable, rescheduleCaptureProcessing } from '../src/studio/capture-processing';
import type { CreativePlan } from '../src/studio/creative-studio';

const EVENT_ID = 'event-automatic-studio';
const CAPTURED_AT = '2030-01-01T00:00:00.000Z';
const PLAN: CreativePlan = {
  template: 'NONE',
  title: 'KHE Moment',
  subtitle: 'Rendu automatique',
  frameStyle: 'GOLD',
  textPosition: 'BOTTOM',
  textStartSeconds: 1,
  textEndSeconds: 4,
  speed: '1x',
  boomerang: false,
  reverse: false,
  freezeFrame: false,
  colorEffect: 'WARM',
  audioMode: 'MIC_ONLY',
  musicRotationEvery: 3,
  music: [],
  background: null,
  showKheBranding: false,
};

function queuedCapture(localId = 'capture-001'): CapturePipelineRecord {
  return {
    localId,
    eventId: EVENT_ID,
    rawUri: `file:///captures-raw/${localId}-raw.mp4`,
    rawContentHash: `raw-hash-${localId}`,
    rawByteSize: 12_345,
    mimeType: 'video/mp4',
    extension: 'mp4',
    aspectRatio: '9:16',
    capturedAt: CAPTURED_AT,
    processingState: 'QUEUED',
    renderPlanJson: JSON.stringify(PLAN),
    selectedMusicJson: null,
    renderSummary: 'cadre or, effet chaud',
    finalUri: null,
    finalContentHash: null,
    finalByteSize: null,
    encoder: null,
    retryCount: 0,
    lastError: null,
    nextAttemptAt: CAPTURED_AT,
    updatedAt: CAPTURED_AT,
  };
}

test('a raw capture stays separate until Studio creates the final output', async () => {
  const store = new MemoryLocalStore();
  const capture = queuedCapture();
  await store.upsertCapture(capture);

  assert.equal((await store.listMedia(EVENT_ID)).length, 0);
  assert.equal((await store.listQueue()).length, 0, 'raw media must never enter the SHARING sync queue');

  const service = new CaptureProcessingService(store, async (input) => {
    assert.equal(input.sourceUri, capture.rawUri);
    assert.deepEqual(input.plan, PLAN);
    return {
      outputUri: 'file:///renders/capture-001-final.mp4',
      byteSize: 11_111,
      contentHash: 'final-hash-capture-001',
      encoder: 'h264_mediacodec',
    };
  });

  assert.deepEqual(await service.drain(EVENT_ID, new Date(CAPTURED_AT)), { attempted: 1, ready: 1, failed: 0 });
  const ready = await store.getCapture(capture.localId);
  const finalMedia = await store.getMedia(capture.localId);

  assert.equal(ready?.processingState, 'READY');
  assert.equal(ready?.rawUri, capture.rawUri, 'the immutable raw file reference must be preserved');
  assert.equal(ready?.finalUri, 'file:///renders/capture-001-final.mp4');
  assert.equal(finalMedia?.localUri, ready?.finalUri);
  assert.equal(finalMedia?.idempotencyKey, `${EVENT_ID}:${capture.localId}:final-v1`);
  assert.equal((await store.listQueue()).length, 1, 'only the completed final output is queued for SHARING');
});

test('a failed Studio render preserves the raw capture and resumes without duplicates', async () => {
  const store = new MemoryLocalStore();
  const capture = queuedCapture('capture-retry');
  await store.upsertCapture(capture);
  let fail = true;
  const service = new CaptureProcessingService(store, async () => {
    if (fail) throw new Error('encodeur temporairement indisponible');
    return {
      outputUri: 'file:///renders/capture-retry-final.mp4',
      byteSize: 10_000,
      contentHash: 'final-hash-capture-retry',
      encoder: 'mpeg4',
    };
  });

  assert.deepEqual(await service.drain(EVENT_ID, new Date(CAPTURED_AT)), { attempted: 1, ready: 0, failed: 1 });
  const failed = await store.getCapture(capture.localId);
  assert.equal(failed?.processingState, 'FAILED');
  assert.equal(failed?.rawUri, capture.rawUri);
  assert.match(failed?.lastError ?? '', /encodeur/);
  assert.equal(await store.getMedia(capture.localId), null);
  assert.equal((await store.listQueue()).length, 0);

  fail = false;
  assert.equal(await rescheduleCaptureProcessing(store, capture.localId), true);
  assert.deepEqual(await service.drain(EVENT_ID, new Date('2030-01-01T00:00:02.000Z')), { attempted: 1, ready: 1, failed: 0 });
  assert.equal((await store.listMedia(EVENT_ID)).length, 1);
  assert.equal((await store.listQueue()).length, 1);

  assert.deepEqual(await service.drain(EVENT_ID, new Date('2030-01-01T00:00:03.000Z')), { attempted: 0, ready: 0, failed: 0 });
  assert.equal((await store.listMedia(EVENT_ID)).length, 1, 'a completed job must not create a duplicate final output');
});

test('a render interrupted by an app restart becomes processable after the stale timeout', () => {
  const capture = { ...queuedCapture('capture-stale'), processingState: 'RENDERING' as const };
  assert.equal(captureIsProcessable(capture, new Date('2030-01-01T00:00:29.999Z')), false);
  assert.equal(captureIsProcessable(capture, new Date('2030-01-01T00:00:30.000Z')), true);
});
