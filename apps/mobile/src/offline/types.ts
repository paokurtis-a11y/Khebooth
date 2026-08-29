import type { AspectRatio, EventManifestContract, MediaSyncState, StationMode, StationSessionContract } from '@khe/contracts';
import type { CaptureRenderJob } from '../studio/render-plan';

export interface PersistedStationContext {
  session: StationSessionContract;
  installationId: string;
  mode: StationMode;
  savedAt: string;
}

export interface LocalMediaRecord {
  localId: string;
  eventId: string;
  idempotencyKey: string;
  contentHash: string;
  byteSize: number;
  mimeType: string;
  localUri: string;
  capturedAt: string;
  syncState: MediaSyncState;
  remoteId: string | null;
  uploadedBytes: number;
  acknowledgedAt: string | null;
  retryCount: number;
  lastError: string | null;
  updatedAt: string;
}

export interface SharedMediaRecord {
  id: string;
  eventId: string;
  localId: string;
  contentHash: string;
  byteSize: number;
  mimeType: string;
  capturedAt: string | null;
  acknowledgedAt: string;
  cachedAt: string;
}

export interface SyncQueueItem {
  localId: string;
  nextAttemptAt: string;
  retryCount: number;
  lastError: string | null;
}

export type LocalRenderState = 'CAPTURED' | 'RENDERING' | 'READY' | 'FAILED';

export interface LocalRenderJob {
  localId: string;
  eventId: string;
  sourceUri: string;
  mimeType: 'image/jpeg' | 'video/mp4';
  extension: 'jpg' | 'mp4';
  aspectRatio: AspectRatio;
  capturedAt: string;
  state: LocalRenderState;
  attemptCount: number;
  nextAttemptAt: string;
  lastError: string | null;
  renderPlan: CaptureRenderJob;
  updatedAt: string;
}

export interface OfflineSnapshot {
  station: PersistedStationContext | null;
  manifest: EventManifestContract | null;
  pendingMedia: LocalMediaRecord[];
  queue: SyncQueueItem[];
  sharedMedia: SharedMediaRecord[];
  renderJobs: LocalRenderJob[];
}
