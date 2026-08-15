import type {
  EventManifestContract,
  MediaAssetContract,
  StationRedeemRequestContract,
  StationRedeemResponseContract,
  SyntheticMediaCreateContract,
  UploadSessionContract,
} from '@khe/contracts';

export interface StationApi {
  redeem(request: StationRedeemRequestContract): Promise<StationRedeemResponseContract>;
  manifest(stationToken: string): Promise<EventManifestContract>;
  listMedia(stationToken: string): Promise<MediaAssetContract[]>;
  createMedia(stationToken: string, media: SyntheticMediaCreateContract): Promise<MediaAssetContract>;
  initializeUpload(stationToken: string, mediaId: string): Promise<UploadSessionContract>;
  updateUpload(stationToken: string, mediaId: string, uploadedBytes: number): Promise<UploadSessionContract>;
  finalizeUpload(stationToken: string, mediaId: string): Promise<MediaAssetContract>;
}

export class HttpStationApi implements StationApi {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
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
      throw new Error(message);
    }

    return (await response.json()) as T;
  }

  private stationHeaders(stationToken: string): HeadersInit {
    return { Authorization: `Bearer ${stationToken}` };
  }

  redeem(request: StationRedeemRequestContract): Promise<StationRedeemResponseContract> {
    return this.request('/stations/redeem', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  manifest(stationToken: string): Promise<EventManifestContract> {
    return this.request('/stations/manifest', { headers: this.stationHeaders(stationToken) });
  }

  listMedia(stationToken: string): Promise<MediaAssetContract[]> {
    return this.request('/stations/media', { headers: this.stationHeaders(stationToken) });
  }

  createMedia(stationToken: string, media: SyntheticMediaCreateContract): Promise<MediaAssetContract> {
    return this.request('/stations/media', {
      method: 'POST',
      headers: this.stationHeaders(stationToken),
      body: JSON.stringify(media),
    });
  }

  initializeUpload(stationToken: string, mediaId: string): Promise<UploadSessionContract> {
    return this.request(`/stations/media/${encodeURIComponent(mediaId)}/upload`, {
      method: 'POST',
      headers: this.stationHeaders(stationToken),
    });
  }

  updateUpload(stationToken: string, mediaId: string, uploadedBytes: number): Promise<UploadSessionContract> {
    return this.request(`/stations/media/${encodeURIComponent(mediaId)}/upload`, {
      method: 'PATCH',
      headers: this.stationHeaders(stationToken),
      body: JSON.stringify({ uploadedBytes }),
    });
  }

  finalizeUpload(stationToken: string, mediaId: string): Promise<MediaAssetContract> {
    return this.request(`/stations/media/${encodeURIComponent(mediaId)}/finalize`, {
      method: 'POST',
      headers: this.stationHeaders(stationToken),
    });
  }
}
