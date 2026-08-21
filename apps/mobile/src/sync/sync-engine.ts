import type { SyntheticMediaCreateContract } from '@khe/contracts';
import type { StationApi } from '../api/station-api';
import type { LocalStore } from '../offline/local-store';
import type { LocalMediaRecord } from '../offline/types';
import type { CredentialVault } from '../security/credential-vault';
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
    private readonly vault: CredentialVault,
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
    const stationToken = await this.vault.getStationToken();
    if (!stationToken) throw new Error('Station credential unavailable');

    const dueQueue = (await this.store.listQueue()).filter((item) => new Date(item.nextAttemptAt).getTime() <= now.getTime());
    const queue = [] as typeof dueQueue;
    for (const item of dueQueue) {
      const media = await this.store.getMedia(item.localId);
      // Media from a previous event intentionally stays queued and stored locally.
      // A station token is event-scoped, so never attempt that media until the
      // CAPTURE tablet is back on the matching event context.
      if (!media || media.eventId !== station.session.eventId) continue;
      queue.push(item);
    }

    const result: DrainResult = { attempted: 0, synced: 0, failed: 0 };

    for (const item of queue) {
      result.attempted += 1;
      try {
        await this.syncOne(stationToken, station.session.eventId, item.localId);
        result.synced += 1;
      } catch (error) {
        result.failed += 1;
        await this.recordFailure(item.localId, error, now);
      }
    }
    return result;
  }

  private async syncOne(stationToken: string, eventId: string, localId: string): Promise<void> {
    const media = await this.store.getMedia(localId);
    if (!media) throw new Error(`Queued media ${localId} is missing from local storage`);
    if (media.eventId !== eventId) {
      throw new Error(`Queued media ${localId} belongs to a different event`);
    }
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
    if (remote.eventId !== eventId) throw new Error('Server created media under a different event');
    let working: LocalMediaRecord = {
      ...media,
      remoteId: remote.id,
      syncState: 'UPLOADING',
      lastError: null,
      updatedAt: new Date().toISOString(),
    };
    await this.store.upsertMedia(working);

    const ticket = await this.api.prepareBlobUpload(stationToken, remote.id);
    if (ticket.mediaId !== remote.id || ticket.byteSize !== working.byteSize || ticket.contentType !== working.mimeType) {
      throw new Error('Signed upload ticket does not match local media metadata');
    }

    if (ticket.alreadyUploaded) {
      working = {
        ...working,
        uploadedBytes: working.byteSize,
        updatedAt: new Date().toISOString(),
      };
      await this.store.upsertMedia(working);
    } else {
      if (!ticket.uploadUrl) throw new Error('Server did not provide a signed upload URL');

      // A signed PUT is atomic at object level. On retry we start its progress at zero,
      // but if a previous PUT actually completed the API detects the existing Blob and
      // returns alreadyUploaded so the file is not transferred twice.
      working = {
        ...working,
        uploadedBytes: 0,
        updatedAt: new Date().toISOString(),
      };
      await this.store.upsertMedia(working);

      let lastReported = 0;
      await this.transfer.transfer(working, ticket.uploadUrl, async (uploadedBytes) => {
        if (uploadedBytes < lastReported) throw new Error('Upload progress cannot move backwards');
        if (uploadedBytes > working.byteSize) throw new Error('Upload progress exceeds local media size');
        if (uploadedBytes === lastReported) return;
        lastReported = uploadedBytes;
        const updated = await this.api.updateUpload(stationToken, remote.id, uploadedBytes);
        working = {
          ...working,
          uploadedBytes: updated.uploadedBytes,
          syncState: 'UPLOADING',
          updatedAt: new Date().toISOString(),
        };
        await this.store.upsertMedia(working);
      });
    }

    if (working.uploadedBytes !== working.byteSize) {
      throw new Error('Transfer ended before all bytes were acknowledged');
    }

    // The server performs a Blob HEAD and validates exact size + MIME before this can succeed.
    const finalized = await this.api.finalizeUpload(stationToken, remote.id);
    if (finalized.media.eventId !== eventId) throw new Error('Finalized media belongs to a different event');
    if (finalized.media.syncState !== 'SYNCED' || !finalized.media.acknowledgedAt) {
      throw new Error('Server did not acknowledge synchronized media');
    }

    const acknowledgedAt =
      finalized.media.acknowledgedAt instanceof Date
        ? finalized.media.acknowledgedAt.toISOString()
        : new Date(finalized.media.acknowledgedAt).toISOString();

    await this.store.upsertMedia({
      ...working,
      syncState: 'SYNCED',
      uploadedBytes: working.byteSize,
      acknowledgedAt,
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
