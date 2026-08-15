import type { EventManifestContract, MediaSyncState, StationMode, StationSessionContract } from '@khe/contracts';

export interface PersistedStationContext {
  stationToken: string;
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

export interface SyncQueueItem {
  localId: string;
  nextAttemptAt: string;
  retryCount: number;
  lastError: string | null;
}

export interface OfflineSnapshot {
  station: PersistedStationContext | null;
  manifest: EventManifestContract | null;
  pendingMedia: LocalMediaRecord[];
  queue: SyncQueueItem[];
}
