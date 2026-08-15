import type { EventManifestContract } from '@khe/contracts';
import type { LocalStore } from './local-store';
import type {
  LocalMediaRecord,
  OfflineSnapshot,
  PersistedStationContext,
  SharedMediaRecord,
  SyncQueueItem,
} from './types';

export class MemoryLocalStore implements LocalStore {
  private station: PersistedStationContext | null = null;
  private readonly manifests = new Map<string, EventManifestContract>();
  private readonly media = new Map<string, LocalMediaRecord>();
  private readonly queue = new Map<string, SyncQueueItem>();
  private readonly sharedMedia = new Map<string, SharedMediaRecord[]>();

  async init(): Promise<void> {}

  async saveStation(context: PersistedStationContext): Promise<void> {
    this.station = structuredClone(context);
  }

  async getStation(): Promise<PersistedStationContext | null> {
    return this.station ? structuredClone(this.station) : null;
  }

  async saveManifest(eventId: string, manifest: EventManifestContract): Promise<void> {
    this.manifests.set(eventId, structuredClone(manifest));
  }

  async getManifest(eventId: string): Promise<EventManifestContract | null> {
    const manifest = this.manifests.get(eventId);
    return manifest ? structuredClone(manifest) : null;
  }

  async upsertMedia(media: LocalMediaRecord): Promise<void> {
    this.media.set(media.localId, structuredClone(media));
  }

  async getMedia(localId: string): Promise<LocalMediaRecord | null> {
    const media = this.media.get(localId);
    return media ? structuredClone(media) : null;
  }

  async listMedia(eventId: string): Promise<LocalMediaRecord[]> {
    return [...this.media.values()]
      .filter((item) => item.eventId === eventId)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
      .map((item) => structuredClone(item));
  }

  async listPendingMedia(eventId: string): Promise<LocalMediaRecord[]> {
    return [...this.media.values()]
      .filter((item) => item.eventId === eventId && item.syncState !== 'SYNCED')
      .map((item) => structuredClone(item));
  }

  async enqueue(item: SyncQueueItem): Promise<void> {
    this.queue.set(item.localId, structuredClone(item));
  }

  async listQueue(): Promise<SyncQueueItem[]> {
    return [...this.queue.values()]
      .sort((a, b) => a.nextAttemptAt.localeCompare(b.nextAttemptAt))
      .map((item) => structuredClone(item));
  }

  async removeQueueItem(localId: string): Promise<void> {
    this.queue.delete(localId);
  }

  async replaceSharedMedia(eventId: string, media: SharedMediaRecord[]): Promise<void> {
    this.sharedMedia.set(eventId, structuredClone(media));
  }

  async listSharedMedia(eventId: string): Promise<SharedMediaRecord[]> {
    return structuredClone(this.sharedMedia.get(eventId) ?? []);
  }

  async snapshot(eventId: string): Promise<OfflineSnapshot> {
    return {
      station: await this.getStation(),
      manifest: await this.getManifest(eventId),
      pendingMedia: await this.listPendingMedia(eventId),
      queue: await this.listQueue(),
      sharedMedia: await this.listSharedMedia(eventId),
    };
  }
}
