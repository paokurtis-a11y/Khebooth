import assert from 'node:assert/strict';
import test from 'node:test';
import { canDeleteRawCapture, deleteRawCapture } from '../src/gallery/raw-capture-deletion';
import { MemoryLocalStore } from '../src/offline/memory-store';
import type { CapturePipelineRecord, LocalMediaRecord } from '../src/offline/types';

function capture(processingState:CapturePipelineRecord['processingState']):CapturePipelineRecord{return{localId:'capture-1',eventId:'event-1',rawUri:'file:///raw.mp4',rawContentHash:'raw',rawByteSize:10,mimeType:'video/mp4',extension:'mp4',aspectRatio:'9:16',capturedAt:'2026-09-04T10:00:00.000Z',processingState,renderPlanJson:'{}',selectedMusicJson:null,renderSummary:'Test',finalUri:'file:///final.mp4',finalContentHash:'final',finalByteSize:20,encoder:'mpeg4',retryCount:0,lastError:null,nextAttemptAt:'2026-09-04T10:00:00.000Z',updatedAt:'2026-09-04T10:00:00.000Z'};}

const finalMedia:LocalMediaRecord={localId:'capture-1',eventId:'event-1',idempotencyKey:'event-1:capture-1:final-v1',contentHash:'final',byteSize:20,mimeType:'video/mp4',localUri:'file:///final.mp4',capturedAt:'2026-09-04T10:00:00.000Z',syncState:'SYNCED',remoteId:'remote-1',uploadedBytes:20,acknowledgedAt:'2026-09-04T10:01:00.000Z',retryCount:0,lastError:null,updatedAt:'2026-09-04T10:01:00.000Z'};

test('a completed raw capture can be deleted without removing its final render',async()=>{
  const store=new MemoryLocalStore();const ready=capture('READY');await store.upsertCapture(ready);await store.upsertMedia(finalMedia);let deletedUri='';
  await deleteRawCapture(store,ready,(uri)=>{deletedUri=uri;});
  assert.equal(deletedUri,ready.rawUri);assert.equal(await store.getCapture(ready.localId),null);assert.deepEqual(await store.getMedia(ready.localId),finalMedia);
});

test('raw deletion is blocked while Studio is still processing',async()=>{
  const store=new MemoryLocalStore();const rendering=capture('RENDERING');await store.upsertCapture(rendering);
  assert.equal(canDeleteRawCapture(rendering),false);
  await assert.rejects(()=>deleteRawCapture(store,rendering,()=>undefined),/Attendez la fin du traitement Studio/);
  assert.deepEqual(await store.getCapture(rendering.localId),rendering);
});
