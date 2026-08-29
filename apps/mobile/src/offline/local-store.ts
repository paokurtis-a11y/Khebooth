import type { EventManifestContract } from '@khe/contracts';
import type {
  LocalMediaRecord,
  LocalRenderJob,
  OfflineSnapshot,
  PersistedStationContext,
  SharedMediaRecord,
  SyncQueueItem,
} from './types';

export interface LocalStore {
  init(): Promise<void>;
  saveStation(context: PersistedStationContext): Promise<void>;
  getStation(): Promise<PersistedStationContext | null>;
  clearStation(): Promise<void>;
  saveManifest(eventId: string, manifest: EventManifestContract): Promise<void>;
  getManifest(eventId: string): Promise<EventManifestContract | null>;
  upsertMedia(media: LocalMediaRecord): Promise<void>;
  getMedia(localId: string): Promise<LocalMediaRecord | null>;
  listMedia(eventId: string): Promise<LocalMediaRecord[]>;
  listPendingMedia(eventId: string): Promise<LocalMediaRecord[]>;
  deleteMedia(localId: string): Promise<void>;
  enqueue(item: SyncQueueItem): Promise<void>;
  listQueue(): Promise<SyncQueueItem[]>;
  removeQueueItem(localId: string): Promise<void>;
  upsertRenderJob(job: LocalRenderJob): Promise<void>;
  getRenderJob(localId: string): Promise<LocalRenderJob | null>;
  listRenderJobs(eventId: string): Promise<LocalRenderJob[]>;
  listPendingRenderJobs(eventId: string): Promise<LocalRenderJob[]>;
  replaceSharedMedia(eventId: string, media: SharedMediaRecord[]): Promise<void>;
  listSharedMedia(eventId: string): Promise<SharedMediaRecord[]>;
  snapshot(eventId: string): Promise<OfflineSnapshot>;
}
