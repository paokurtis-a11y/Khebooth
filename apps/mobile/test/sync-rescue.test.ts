import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryLocalStore } from '../src/offline/memory-store';
import type { LocalMediaRecord } from '../src/offline/types';
import { rescheduleMediaNow, reschedulePendingMediaNow } from '../src/sync/sync-rescue';

const EVENT_ID='11111111-1111-4111-8111-111111111111';
const OTHER_EVENT_ID='22222222-2222-4222-8222-222222222222';
const NOW=new Date('2026-08-22T08:20:00.000Z');

function media(localId:string,eventId:string,syncState:LocalMediaRecord['syncState'],retryCount=0,lastError:string|null=null):LocalMediaRecord{
  return{localId,eventId,idempotencyKey:`key:${localId}`,contentHash:`sha256:${localId}`,byteSize:100,mimeType:'video/mp4',localUri:`file:///${localId}.mp4`,capturedAt:'2026-08-22T08:00:00.000Z',syncState,remoteId:null,uploadedBytes:0,acknowledgedAt:syncState==='SYNCED'?'2026-08-22T08:01:00.000Z':null,retryCount,lastError,updatedAt:'2026-08-22T08:10:00.000Z'};
}

test('reschedules every pending media for the active event immediately without erasing retry diagnostics',async()=>{
  const store=new MemoryLocalStore();
  await store.upsertMedia(media('queued',EVENT_ID,'QUEUED'));
  await store.upsertMedia(media('failed',EVENT_ID,'FAILED',6,'network interruption'));
  await store.upsertMedia(media('synced',EVENT_ID,'SYNCED'));
  await store.upsertMedia(media('other-event',OTHER_EVENT_ID,'FAILED',9,'other event'));

  await store.enqueue({localId:'queued',nextAttemptAt:'2026-08-22T09:00:00.000Z',retryCount:0,lastError:null});
  await store.enqueue({localId:'failed',nextAttemptAt:'2026-08-22T09:00:00.000Z',retryCount:6,lastError:'network interruption'});
  await store.enqueue({localId:'other-event',nextAttemptAt:'2026-08-22T09:00:00.000Z',retryCount:9,lastError:'other event'});

  const result=await reschedulePendingMediaNow(store,EVENT_ID,NOW);
  assert.deepEqual(result,{eventId:EVENT_ID,rescheduled:2,failedMedia:1,highestRetryCount:6});

  const queue=await store.listQueue();
  const queued=queue.find((item)=>item.localId==='queued');
  const failed=queue.find((item)=>item.localId==='failed');
  const other=queue.find((item)=>item.localId==='other-event');
  assert.equal(queued?.nextAttemptAt,NOW.toISOString());
  assert.equal(failed?.nextAttemptAt,NOW.toISOString());
  assert.equal(failed?.retryCount,6);
  assert.equal(failed?.lastError,'network interruption');
  assert.equal(other?.nextAttemptAt,'2026-08-22T09:00:00.000Z','another event must not be rescheduled');
});

test('single-media rescue refuses synced, missing, and cross-event records',async()=>{
  const store=new MemoryLocalStore();
  await store.upsertMedia(media('pending',EVENT_ID,'FAILED',2,'timeout'));
  await store.upsertMedia(media('synced',EVENT_ID,'SYNCED'));
  await store.upsertMedia(media('other',OTHER_EVENT_ID,'FAILED'));

  assert.equal(await rescheduleMediaNow(store,EVENT_ID,'pending',NOW),true);
  assert.equal(await rescheduleMediaNow(store,EVENT_ID,'synced',NOW),false);
  assert.equal(await rescheduleMediaNow(store,EVENT_ID,'other',NOW),false);
  assert.equal(await rescheduleMediaNow(store,EVENT_ID,'missing',NOW),false);

  const queue=await store.listQueue();
  assert.deepEqual(queue.map((item)=>item.localId),['pending']);
  assert.equal(queue[0]?.retryCount,2);
  assert.equal(queue[0]?.lastError,'timeout');
});
