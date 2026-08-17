import type {
  BlobUploadTicketContract,
  EventManifestContract,
  FinalizeUploadResponseContract,
  MediaAssetContract,
  MediaDownloadTicketContract,
  StationControlCommandContract,
  StationControlContract,
  StationControlStatusContract,
  StationLiveSessionContract,
  StationRedeemRequestContract,
  StationRedeemResponseContract,
  SyntheticMediaCreateContract,
  UploadSessionContract,
} from '@khe/contracts';
import * as SecureStore from 'expo-secure-store';

const STATION_TOKEN_KEY = 'khe.station.token.v1';

export interface MediaShareContract {
  id: string;
  mediaId: string;
  shareUrl: string;
  createdAt: string | Date;
}

export interface StationApi {
  redeem(request: StationRedeemRequestContract): Promise<StationRedeemResponseContract>;
  manifest(stationToken: string): Promise<EventManifestContract>;
  liveSession(stationToken: string): Promise<StationLiveSessionContract>;
  control(stationToken: string): Promise<StationControlContract>;
  updateControlCommand(stationToken: string, command: StationControlCommandContract): Promise<StationControlContract>;
  updateControlStatus(stationToken: string, status: StationControlStatusContract): Promise<StationControlContract>;
  listMedia(stationToken: string): Promise<MediaAssetContract[]>;
  createMedia(stationToken: string, media: SyntheticMediaCreateContract): Promise<MediaAssetContract>;
  prepareBlobUpload(stationToken: string, mediaId: string): Promise<BlobUploadTicketContract & { alreadyUploaded?: boolean }>;
  mediaDownload(stationToken: string, mediaId: string): Promise<MediaDownloadTicketContract>;
  createMediaShare(stationToken: string, mediaId: string): Promise<MediaShareContract>;
  revokeMediaShare(stationToken: string, shareId: string): Promise<{ id: string; revoked: boolean }>;
  initializeUpload(stationToken: string, mediaId: string): Promise<UploadSessionContract>;
  updateUpload(stationToken: string, mediaId: string, uploadedBytes: number): Promise<UploadSessionContract>;
  finalizeUpload(stationToken: string, mediaId: string): Promise<FinalizeUploadResponseContract>;
}

class StationApiHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'StationApiHttpError';
  }
}

export class HttpStationApi implements StationApi {
  private readonly renewedTokens = new Map<string, string>();
  private renewalPromise: Promise<string> | null = null;

  constructor(private readonly baseUrl: string) {}

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}${path}`;
  }

  private resolvedToken(stationToken: string): string {
    let current = stationToken;
    const visited = new Set<string>();
    while (this.renewedTokens.has(current) && !visited.has(current)) {
      visited.add(current);
      current = this.renewedTokens.get(current) ?? current;
    }
    return current;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(this.url(path), {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const payload = (await response.json()) as { message?: string | string[] };
        if (Array.isArray(payload.message)) message = payload.message.join(', ');
        else if (payload.message) message = payload.message;
      } catch {
        // Keep the status-based message when the server body is not JSON.
      }
      throw new StationApiHttpError(response.status, message);
    }

    return (await response.json()) as T;
  }

  private async renewToken(stationToken: string): Promise<string> {
    const current = this.resolvedToken(stationToken);
    if (!this.renewalPromise) {
      this.renewalPromise = this.request<StationRedeemResponseContract>('/stations/renew', {
        method: 'POST',
        headers: { Authorization: `Bearer ${current}` },
      })
        .then(async (response) => {
          this.renewedTokens.set(stationToken, response.stationToken);
          this.renewedTokens.set(current, response.stationToken);
          await SecureStore.setItemAsync(STATION_TOKEN_KEY, response.stationToken, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          });
          return response.stationToken;
        })
        .finally(() => {
          this.renewalPromise = null;
        });
    }
    return this.renewalPromise;
  }

  private async stationRequest<T>(path: string, stationToken: string, init?: RequestInit): Promise<T> {
    const execute = (token: string) => this.request<T>(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });

    const current = this.resolvedToken(stationToken);
    try {
      return await execute(current);
    } catch (error) {
      if (!(error instanceof StationApiHttpError) || error.status !== 401) throw error;
      const renewed = await this.renewToken(current);
      return execute(renewed);
    }
  }

  redeem(request: StationRedeemRequestContract): Promise<StationRedeemResponseContract> {
    return this.request('/stations/redeem', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  manifest(stationToken: string): Promise<EventManifestContract> {
    return this.stationRequest('/stations/manifest', stationToken);
  }

  liveSession(stationToken: string): Promise<StationLiveSessionContract> {
    return this.stationRequest('/stations/live-session', stationToken);
  }

  control(stationToken: string): Promise<StationControlContract> {
    return this.stationRequest('/stations/control', stationToken);
  }

  updateControlCommand(stationToken: string, command: StationControlCommandContract): Promise<StationControlContract> {
    return this.stationRequest('/stations/control/command', stationToken, {
      method: 'PATCH',
      body: JSON.stringify(command),
    });
  }

  updateControlStatus(stationToken: string, status: StationControlStatusContract): Promise<StationControlContract> {
    return this.stationRequest('/stations/control/status', stationToken, {
      method: 'PATCH',
      body: JSON.stringify(status),
    });
  }

  listMedia(stationToken: string): Promise<MediaAssetContract[]> {
    return this.stationRequest('/stations/media', stationToken);
  }

  createMedia(stationToken: string, media: SyntheticMediaCreateContract): Promise<MediaAssetContract> {
    return this.stationRequest('/stations/media', stationToken, {
      method: 'POST',
      body: JSON.stringify(media),
    });
  }

  prepareBlobUpload(stationToken: string, mediaId: string): Promise<BlobUploadTicketContract & { alreadyUploaded?: boolean }> {
    return this.stationRequest(`/stations/media/${encodeURIComponent(mediaId)}/blob-upload`, stationToken, { method: 'POST' });
  }

  mediaDownload(stationToken: string, mediaId: string): Promise<MediaDownloadTicketContract> {
    return this.stationRequest(`/stations/media/${encodeURIComponent(mediaId)}/download`, stationToken);
  }

  createMediaShare(stationToken: string, mediaId: string): Promise<MediaShareContract> {
    return this.stationRequest(`/stations/media/${encodeURIComponent(mediaId)}/share`, stationToken, { method: 'POST' });
  }

  revokeMediaShare(stationToken: string, shareId: string): Promise<{ id: string; revoked: boolean }> {
    return this.stationRequest(`/stations/shares/${encodeURIComponent(shareId)}/revoke`, stationToken, { method: 'POST' });
  }

  initializeUpload(stationToken: string, mediaId: string): Promise<UploadSessionContract> {
    return this.stationRequest(`/stations/media/${encodeURIComponent(mediaId)}/upload`, stationToken, { method: 'POST' });
  }

  updateUpload(stationToken: string, mediaId: string, uploadedBytes: number): Promise<UploadSessionContract> {
    return this.stationRequest(`/stations/media/${encodeURIComponent(mediaId)}/upload`, stationToken, {
      method: 'PATCH',
      body: JSON.stringify({ uploadedBytes }),
    });
  }

  finalizeUpload(stationToken: string, mediaId: string): Promise<FinalizeUploadResponseContract> {
    return this.stationRequest(`/stations/media/${encodeURIComponent(mediaId)}/finalize`, stationToken, { method: 'POST' });
  }
}
