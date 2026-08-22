import type { LocalStore } from '../offline/local-store';
import type { LocalMediaRecord } from '../offline/types';

export interface SyncRescueResult {
  eventId: string;
  rescheduled: number;
  failedMedia: number;
  highestRetryCount: number;
}

function pendingForEvent(media: LocalMediaRecord[], eventId: string): LocalMediaRecord[] {
  return media.filter((item) => item.eventId === eventId && item.syncState !== 'SYNCED');
}

/**
 * Moves pending media for one event to the front of the local retry queue.
 * It never resets retryCount/lastError and never touches media from another event.
 * The regular CAPTURE sync runner remains responsible for the actual upload.
 */
export async function reschedulePendingMediaNow(
  store: LocalStore,
  eventId: string,
  now = new Date(),
): Promise<SyncRescueResult> {
  await store.init();
  const pending = pendingForEvent(await store.listPendingMedia(eventId), eventId);
  const nextAttemptAt = now.toISOString();

  for (const media of pending) {
    await store.enqueue({
      localId: media.localId,
      nextAttemptAt,
      retryCount: media.retryCount,
      lastError: media.lastError,
    });
  }

  return {
    eventId,
    rescheduled: pending.length,
    failedMedia: pending.filter((item) => item.syncState === 'FAILED').length,
    highestRetryCount: pending.reduce((highest, item) => Math.max(highest, item.retryCount), 0),
  };
}

export async function rescheduleMediaNow(
  store: LocalStore,
  eventId: string,
  localId: string,
  now = new Date(),
): Promise<boolean> {
  await store.init();
  const media = await store.getMedia(localId);
  if (!media || media.eventId !== eventId || media.syncState === 'SYNCED') return false;

  await store.enqueue({
    localId: media.localId,
    nextAttemptAt: now.toISOString(),
    retryCount: media.retryCount,
    lastError: media.lastError,
  });
  return true;
}
