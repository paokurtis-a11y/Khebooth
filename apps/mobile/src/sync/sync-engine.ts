import type { SyntheticMediaCreateContract } from '@khe/contracts';
import type { StationApi } from '../api/station-api';
import type { LocalStore } from '../offline/local-store';
import type { LocalMediaRecord } from '../offline/types';
import type { MediaTransfer } from './media-transfer';

export interface QueueMediaInput {
  eventId: string;
  localId: string;
  idempotencyKey: string;
  contentHash: string;
  byteSize: number;
  mimeType: string;
  localUri: string;
  capturedAt?: string;
}

export interface DrainResult {
  attempted: number;
  synced: number;
  failed: number;
}

export class SyncEngine {
  constructor(
    private readonly api: StationApi,
    private readonly store: LocalStore,
    private readonly transfer: MediaTransfer,
  ) {}

  async queueMedia(input: QueueMediaInput): Promise<LocalMediaRecord> {
    if (input.byteSize <= 0) throw new Error('Media byteSize must be positive');
    const now = new Date().toISOString();
    const existing = await this.store.getMedia(input.localId);
    if (existing) {
      if (
        existing.eventId !== input.eventId ||
        existing.idempotencyKey !== input.idempotencyKey ||
        existing.contentHash !== input.contentHash ||
        existing.byteSize !== input.byteSize ||
        existing.mimeType !== input.mimeType ||
        existing.localUri !== input.localUri
      ) {
        throw new Error('localId is already associated with different media');
      }
      return existing;
    }

    const media: LocalMediaRecord = {
      localId: input.localId,
      eventId: input.eventId,
      idempotencyKey: input.idempotencyKey,
      contentHash: input.contentHash,
      byteSize: input.byteSize,
      mimeType: input.mimeType,
      localUri: input.localUri,
      capturedAt: input.capturedAt ?? now,
      syncState: 'QUEUED',
      remoteId: null,
      uploadedBytes: 0,
      acknowledgedAt: null,
      retryCount: 0,
      lastError: null,
      updatedAt: now,
    };
    await this.store.upsertMedia(media);
    await this.store.enqueue({ localId: media.localId, nextAttemptAt: now, retryCount: 0, lastError: null });
    return media;
  }

  async drain(now = new Date()): Promise<DrainResult> {
    await this.store.init();
    const station = await this.store.getStation();
    if (!station) throw new Error('Station not activated');
    if (station.mode !== 'CAPTURE') throw new Error('Only CAPTURE stations can synchronize media uploads');

    const queue = (await this.store.listQueue()).filter((item) => new Date(item.nextAttemptAt).getTime() <= now.getTime());
    const result: DrainResult = { attempted: 0, synced: 0, failed: 0 };

    for (const item of queue) {
      result.attempted += 1;
      try {
        await this.syncOne(station.stationToken, item.localId);
        result.synced += 1;
      } catch (error) {
        result.failed += 1;
        await this.recordFailure(item.localId, error, now);
      }
    }
    return result;
  }

  private async syncOne(stationToken: string, localId: string): Promise<void> {
    const media = await this.store.getMedia(localId);
    if (!media) throw new Error(`Queued media ${localId} is missing from local storage`);
    if (media.syncState === 'SYNCED') {
      await this.store.removeQueueItem(localId);
      return;
    }

    const payload: SyntheticMediaCreateContract = {
      localId: media.localId,
      idempotencyKey: media.idempotencyKey,
      contentHash: media.contentHash,
      byteSize: media.byteSize,
      mimeType: media.mimeType,
      capturedAt: media.capturedAt,
    };

    const remote = await this.api.createMedia(stationToken, payload);
    let working: LocalMediaRecord = {
      ...media,
      remoteId: remote.id,
      syncState: 'UPLOADING',
      lastError: null,
      updatedAt: new Date().toISOString(),
    };
    await this.store.upsertMedia(working);

    const upload = await this.api.initializeUpload(stationToken, remote.id);
    const resumeFrom = Math.max(working.uploadedBytes, upload.uploadedBytes);
    if (resumeFrom > working.byteSize) throw new Error('Server resume checkpoint exceeds local media size');

    if (resumeFrom !== working.uploadedBytes) {
      working = { ...working, uploadedBytes: resumeFrom, updatedAt: new Date().toISOString() };
      await this.store.upsertMedia(working);
    }

    await this.transfer.transfer(working, resumeFrom, async (uploadedBytes) => {
      if (uploadedBytes < working.uploadedBytes) throw new Error('Upload progress cannot move backwards');
      if (uploadedBytes > working.byteSize) throw new Error('Upload progress exceeds local media size');
      const updated = await this.api.updateUpload(stationToken, remote.id, uploadedBytes);
      working = {
        ...working,
        uploadedBytes: updated.uploadedBytes,
        syncState: 'UPLOADING',
        updatedAt: new Date().toISOString(),
      };
      await this.store.upsertMedia(working);
    });

    if (working.uploadedBytes < working.byteSize) {
      const status = await this.api.initializeUpload(stationToken, remote.id);
      working = { ...working, uploadedBytes: status.uploadedBytes, updatedAt: new Date().toISOString() };
      await this.store.upsertMedia(working);
    }
    if (working.uploadedBytes !== working.byteSize) throw new Error('Transfer ended before all bytes were acknowledged');

    const finalized = await this.api.finalizeUpload(stationToken, remote.id);
    if (finalized.media.syncState !== 'SYNCED' || !finalized.media.acknowledgedAt) {
      throw new Error('Server did not acknowledge synchronized media');
    }

    await this.store.upsertMedia({
      ...working,
      syncState: 'SYNCED',
      uploadedBytes: working.byteSize,
      acknowledgedAt: new Date(finalized.media.acknowledgedAt).toISOString(),
      retryCount: 0,
      lastError: null,
      updatedAt: new Date().toISOString(),
    });

    // Only the queue item is removed. The local media record and localUri are retained.
    await this.store.removeQueueItem(localId);
  }

  private async recordFailure(localId: string, error: unknown, now: Date): Promise<void> {
    const media = await this.store.getMedia(localId);
    if (!media) return;
    const retryCount = media.retryCount + 1;
    const message = error instanceof Error ? error.message : 'Unknown synchronization error';
    const delayMs = Math.min(60_000, 1_000 * 2 ** Math.min(retryCount - 1, 6));
    const nextAttemptAt = new Date(now.getTime() + delayMs).toISOString();

    await this.store.upsertMedia({
      ...media,
      syncState: 'FAILED',
      retryCount,
      lastError: message,
      updatedAt: now.toISOString(),
    });
    await this.store.enqueue({ localId, nextAttemptAt, retryCount, lastError: message });
  }
}
