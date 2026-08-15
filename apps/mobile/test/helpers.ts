import type {
  EventManifestContract,
  FinalizeUploadResponseContract,
  MediaAssetContract,
  StationControlCommandContract,
  StationControlContract,
  StationControlStatusContract,
  StationLiveSessionContract,
  StationRedeemRequestContract,
  StationRedeemResponseContract,
  UploadSessionContract,
} from '@khe/contracts';
import type { StationApi } from '../src/api/station-api';

export const TEST_EVENT_ID = '11111111-1111-4111-8111-111111111111';
export const TEST_ORG_ID = '22222222-2222-4222-8222-222222222222';

export function testManifest(): EventManifestContract {
  return {
    version: 1,
    generatedAt: '2026-08-15T06:00:00.000Z',
    event: {
      id: TEST_EVENT_ID,
      name: 'Offline Test Event',
      startsAt: '2026-08-15T18:00:00.000Z',
      endsAt: null,
      venueName: 'Test Venue',
      venueAddress: null,
      status: 'ACTIVE',
    },
    client: null,
    preset: null,
    organization: { id: TEST_ORG_ID, name: 'KHE Test' },
    capabilities: { capture: true, sharing: true, separateStations: true, formats: ['9:16', '1:1'] },
    mediaPolicy: {
      offlineFirst: true,
      preserveUnsyncedMedia: true,
      idempotentUploads: true,
      resumableUploads: true,
      export: { container: 'MP4', videoCodec: 'H.264', audioCodec: 'AAC' },
    },
  };
}

type ServerMedia = MediaAssetContract & { idempotencyKey: string; uploadedBytes: number };

export class FakeStationApi implements StationApi {
  readonly mediaByIdempotency = new Map<string, ServerMedia>();
  createCalls = 0;
  failListMedia = false;
  private controlState: StationControlContract = {
    eventId: TEST_EVENT_ID,
    command: 'NONE',
    commandVersion: 0,
    acknowledgedVersion: 0,
    runtimeState: 'IDLE',
    selectedEffect: 'NONE',
    maxDurationSeconds: 15,
    elapsedSeconds: 0,
    captureSeenAt: null,
    updatedAt: '2026-08-15T06:00:00.000Z',
  };

  async redeem(request: StationRedeemRequestContract): Promise<StationRedeemResponseContract> {
    return {
      stationToken: request.mode === 'CAPTURE' ? 'capture-token' : 'sharing-token',
      session: {
        id: request.mode === 'CAPTURE' ? '33333333-3333-4333-8333-333333333333' : '44444444-4444-4444-8444-444444444444',
        organizationId: TEST_ORG_ID,
        eventId: TEST_EVENT_ID,
        deviceId: request.mode === 'CAPTURE' ? '55555555-5555-4555-8555-555555555555' : '66666666-6666-4666-8666-666666666666',
        mode: request.mode,
        expiresAt: '2026-08-16T06:00:00.000Z',
      },
      manifest: testManifest(),
    };
  }

  async manifest(): Promise<EventManifestContract> {
    return testManifest();
  }

  async liveSession(stationToken: string): Promise<StationLiveSessionContract> {
    const capture = stationToken === 'capture-token';
    return {
      provider: 'livekit',
      serverUrl: 'wss://live.example.test',
      participantToken: capture ? 'capture-live-token' : 'sharing-live-token',
      roomName: `khe-event-${TEST_EVENT_ID}`,
      participantIdentity: capture ? 'capture-test-session' : 'sharing-test-session',
      mode: capture ? 'CAPTURE' : 'SHARING',
      canPublish: capture,
      canSubscribe: !capture,
    };
  }

  async control(): Promise<StationControlContract> {
    return { ...this.controlState };
  }

  async updateControlCommand(
    _stationToken: string,
    command: StationControlCommandContract,
  ): Promise<StationControlContract> {
    if (command.command) {
      this.controlState.command = command.command;
      this.controlState.commandVersion += 1;
    }
    if (command.selectedEffect) this.controlState.selectedEffect = command.selectedEffect;
    if (command.maxDurationSeconds !== undefined) this.controlState.maxDurationSeconds = command.maxDurationSeconds;
    this.controlState.updatedAt = new Date().toISOString();
    return { ...this.controlState };
  }

  async updateControlStatus(
    _stationToken: string,
    status: StationControlStatusContract,
  ): Promise<StationControlContract> {
    if (status.acknowledgedVersion !== undefined) this.controlState.acknowledgedVersion = status.acknowledgedVersion;
    if (status.runtimeState !== undefined) this.controlState.runtimeState = status.runtimeState;
    if (status.elapsedSeconds !== undefined) this.controlState.elapsedSeconds = status.elapsedSeconds;
    if (status.maxDurationSeconds !== undefined) this.controlState.maxDurationSeconds = status.maxDurationSeconds;
    this.controlState.captureSeenAt = new Date().toISOString();
    this.controlState.updatedAt = new Date().toISOString();
    return { ...this.controlState };
  }

  async listMedia(): Promise<MediaAssetContract[]> {
    if (this.failListMedia) throw new Error('network offline');
    return [...this.mediaByIdempotency.values()].filter((item) => item.syncState === 'SYNCED');
  }

  async createMedia(_stationToken: string, input: Parameters<StationApi['createMedia']>[1]): Promise<MediaAssetContract> {
    this.createCalls += 1;
    const existing = this.mediaByIdempotency.get(input.idempotencyKey);
    if (existing) return existing;
    const media: ServerMedia = {
      id: '77777777-7777-4777-8777-777777777777',
      organizationId: TEST_ORG_ID,
      eventId: TEST_EVENT_ID,
      localId: input.localId,
      idempotencyKey: input.idempotencyKey,
      contentHash: input.contentHash,
      byteSize: input.byteSize,
      mimeType: input.mimeType,
      syncState: 'QUEUED',
      capturedAt: input.capturedAt ?? null,
      acknowledgedAt: null,
      uploadedBytes: 0,
    };
    this.mediaByIdempotency.set(input.idempotencyKey, media);
    return media;
  }

  async initializeUpload(_stationToken: string, mediaId: string): Promise<UploadSessionContract> {
    const media = this.findMedia(mediaId);
    return {
      id: '88888888-8888-4888-8888-888888888888',
      mediaAssetId: media.id,
      state: media.uploadedBytes === media.byteSize ? 'IN_PROGRESS' : 'INITIALIZED',
      uploadedBytes: media.uploadedBytes,
      totalBytes: media.byteSize,
      updatedAt: new Date().toISOString(),
    };
  }

  async updateUpload(_stationToken: string, mediaId: string, uploadedBytes: number): Promise<UploadSessionContract> {
    const media = this.findMedia(mediaId);
    if (uploadedBytes < media.uploadedBytes) throw new Error('progress backwards');
    if (uploadedBytes > media.byteSize) throw new Error('progress too large');
    media.uploadedBytes = uploadedBytes;
    media.syncState = 'UPLOADING';
    return {
      id: '88888888-8888-4888-8888-888888888888',
      mediaAssetId: media.id,
      state: 'IN_PROGRESS',
      uploadedBytes,
      totalBytes: media.byteSize,
      updatedAt: new Date().toISOString(),
    };
  }

  async finalizeUpload(_stationToken: string, mediaId: string): Promise<FinalizeUploadResponseContract> {
    const media = this.findMedia(mediaId);
    if (media.uploadedBytes !== media.byteSize) throw new Error('Upload is incomplete');
    media.syncState = 'SYNCED';
    media.acknowledgedAt = new Date().toISOString();
    return {
      media,
      upload: {
        id: '88888888-8888-4888-8888-888888888888',
        mediaAssetId: media.id,
        state: 'COMPLETED',
        uploadedBytes: media.uploadedBytes,
        totalBytes: media.byteSize,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  private findMedia(mediaId: string): ServerMedia {
    const media = [...this.mediaByIdempotency.values()].find((item) => item.id === mediaId);
    if (!media) throw new Error('media not found');
    return media;
  }
}
