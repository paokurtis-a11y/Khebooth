import type { EventManifestContract } from '@khe/contracts';
import type { LocalMediaRecord, OfflineSnapshot, PersistedStationContext, SyncQueueItem } from './types';

export interface LocalStore {
  init(): Promise<void>;
  saveStation(context: PersistedStationContext): Promise<void>;
  getStation(): Promise<PersistedStationContext | null>;
  saveManifest(eventId: string, manifest: EventManifestContract): Promise<void>;
  getManifest(eventId: string): Promise<EventManifestContract | null>;
  upsertMedia(media: LocalMediaRecord): Promise<void>;
  getMedia(localId: string): Promise<LocalMediaRecord | null>;
  listPendingMedia(eventId: string): Promise<LocalMediaRecord[]>;
  enqueue(item: SyncQueueItem): Promise<void>;
  listQueue(): Promise<SyncQueueItem[]>;
  removeQueueItem(localId: string): Promise<void>;
  snapshot(eventId: string): Promise<OfflineSnapshot>;
}
