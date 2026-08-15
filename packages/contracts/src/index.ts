export const USER_ROLES = ['OWNER', 'ADMIN', 'OPERATOR', 'SHARE_HOST'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const EVENT_STATUSES = ['DRAFT', 'READY', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const ASPECT_RATIOS = ['9:16', '1:1'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const STATION_MODES = ['CAPTURE', 'SHARING'] as const;
export type StationMode = (typeof STATION_MODES)[number];

export const MEDIA_SYNC_STATES = ['QUEUED', 'UPLOADING', 'SYNCED', 'FAILED'] as const;
export type MediaSyncState = (typeof MEDIA_SYNC_STATES)[number];

export const UPLOAD_STATES = ['INITIALIZED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] as const;
export type UploadState = (typeof UPLOAD_STATES)[number];

export const REMOTE_CAPTURE_COMMANDS = ['NONE', 'START', 'PAUSE', 'RESUME', 'STOP'] as const;
export type RemoteCaptureCommand = (typeof REMOTE_CAPTURE_COMMANDS)[number];

export const REMOTE_CAPTURE_STATES = ['IDLE', 'COUNTDOWN', 'RECORDING', 'PAUSED', 'SAVING', 'ERROR'] as const;
export type RemoteCaptureState = (typeof REMOTE_CAPTURE_STATES)[number];

export const VISUAL_EFFECTS = ['NONE', 'WARM', 'COOL', 'GOLD', 'PARTY'] as const;
export type VisualEffect = (typeof VISUAL_EFFECTS)[number];

export interface AuthUserContract {
  id: string;
  organizationId: string;
  email: string;
  role: UserRole;
  firstName?: string | null;
  lastName?: string | null;
}

export interface LoginResponseContract {
  accessToken: string;
  user: AuthUserContract;
}

export interface EventManifestContract {
  version: 1;
  generatedAt: string | Date;
  event: {
    id: string;
    name: string;
    startsAt: string | Date;
    endsAt: string | Date | null;
    venueName: string | null;
    venueAddress: string | null;
    status: EventStatus;
  };
  client: {
    id: string;
    name: string;
    companyName: string | null;
  } | null;
  preset: {
    id: string;
    name: string;
    aspectRatio: 'PORTRAIT_9_16' | 'SQUARE_1_1';
    configuration: unknown;
  } | null;
  organization: {
    id: string;
    name: string;
  } | null;
  capabilities: {
    capture: true;
    sharing: true;
    separateStations: true;
    formats: AspectRatio[];
  };
  mediaPolicy: {
    offlineFirst: true;
    preserveUnsyncedMedia: true;
    idempotentUploads: true;
    resumableUploads: true;
    export: {
      container: 'MP4';
      videoCodec: 'H.264';
      audioCodec: 'AAC';
    };
  };
}

export interface StationRedeemRequestContract {
  /** Optional for backward compatibility. New clients activate using the code only. */
  eventId?: string;
  code: string;
  installationId: string;
  mode: StationMode;
  deviceName?: string;
  platform?: string;
}

export interface StationSessionContract {
  id: string;
  organizationId: string;
  eventId: string;
  deviceId: string;
  mode: StationMode;
  expiresAt: string | Date;
}

export interface StationRedeemResponseContract {
  stationToken: string;
  session: StationSessionContract;
  manifest: EventManifestContract;
}

export interface StationControlContract {
  eventId: string;
  command: RemoteCaptureCommand;
  commandVersion: number;
  acknowledgedVersion: number;
  runtimeState: RemoteCaptureState;
  selectedEffect: VisualEffect;
  elapsedSeconds: number;
  captureSeenAt: string | Date | null;
  updatedAt: string | Date;
}

export interface StationControlCommandContract {
  command?: Exclude<RemoteCaptureCommand, 'NONE'>;
  selectedEffect?: VisualEffect;
}

export interface StationControlStatusContract {
  acknowledgedVersion?: number;
  runtimeState?: RemoteCaptureState;
  elapsedSeconds?: number;
}

export interface SyntheticMediaCreateContract {
  localId: string;
  idempotencyKey: string;
  contentHash: string;
  byteSize: number;
  mimeType: string;
  capturedAt?: string | Date;
}

export interface MediaAssetContract {
  id: string;
  organizationId: string;
  eventId: string;
  localId: string;
  contentHash: string;
  byteSize: number;
  mimeType: string;
  syncState: MediaSyncState;
  capturedAt: string | Date | null;
  acknowledgedAt: string | Date | null;
}

export interface UploadSessionContract {
  id: string;
  mediaAssetId: string;
  state: UploadState;
  uploadedBytes: number;
  totalBytes: number;
  updatedAt: string | Date;
}

export interface FinalizeUploadResponseContract {
  media: MediaAssetContract;
  upload: UploadSessionContract;
}
