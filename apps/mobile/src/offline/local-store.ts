import type { EventManifestContract } from '@khe/contracts';
import type {
  CapturePipelineRecord,
  LocalMediaRecord,
  OfflineSnapshot,
  PersistedStationContext,
  QueuedDiagnosticReport,
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
  upsertCapture(capture: CapturePipelineRecord): Promise<void>;
  getCapture(localId: string): Promise<CapturePipelineRecord | null>;
  listCaptures(eventId: string): Promise<CapturePipelineRecord[]>;
  deleteCapture(localId: string): Promise<void>;
  enqueue(item: SyncQueueItem): Promise<void>;
  listQueue(): Promise<SyncQueueItem[]>;
  removeQueueItem(localId: string): Promise<void>;
  upsertDiagnostic(report: QueuedDiagnosticReport): Promise<void>;
  listPendingDiagnostics(limit?: number): Promise<QueuedDiagnosticReport[]>;
  removeDiagnostic(reportId: string): Promise<void>;
  replaceSharedMedia(eventId: string, media: SharedMediaRecord[]): Promise<void>;
  listSharedMedia(eventId: string): Promise<SharedMediaRecord[]>;
  snapshot(eventId: string): Promise<OfflineSnapshot>;
}
