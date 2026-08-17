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

  liveSession(stationToken: string): Promise<StationLiveSessionContract> {
    return this.request('/stations/live-session', { headers: this.stationHeaders(stationToken) });
  }

  control(stationToken: string): Promise<StationControlContract> {
    return this.request('/stations/control', { headers: this.stationHeaders(stationToken) });
  }

  updateControlCommand(
    stationToken: string,
    command: StationControlCommandContract,
  ): Promise<StationControlContract> {
    return this.request('/stations/control/command', {
      method: 'PATCH',
      headers: this.stationHeaders(stationToken),
      body: JSON.stringify(command),
    });
  }

  updateControlStatus(
    stationToken: string,
    status: StationControlStatusContract,
  ): Promise<StationControlContract> {
    return this.request('/stations/control/status', {
      method: 'PATCH',
      headers: this.stationHeaders(stationToken),
      body: JSON.stringify(status),
    });
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

  prepareBlobUpload(stationToken: string, mediaId: string): Promise<BlobUploadTicketContract & { alreadyUploaded?: boolean }> {
    return this.request(`/stations/media/${encodeURIComponent(mediaId)}/blob-upload`, {
      method: 'POST',
      headers: this.stationHeaders(stationToken),
    });
  }

  mediaDownload(stationToken: string, mediaId: string): Promise<MediaDownloadTicketContract> {
    return this.request(`/stations/media/${encodeURIComponent(mediaId)}/download`, {
      headers: this.stationHeaders(stationToken),
    });
  }

  createMediaShare(stationToken: string, mediaId: string): Promise<MediaShareContract> {
    return this.request(`/stations/media/${encodeURIComponent(mediaId)}/share`, {
      method: 'POST',
      headers: this.stationHeaders(stationToken),
    });
  }

  revokeMediaShare(stationToken: string, shareId: string): Promise<{ id: string; revoked: boolean }> {
    return this.request(`/stations/shares/${encodeURIComponent(shareId)}/revoke`, {
      method: 'POST',
      headers: this.stationHeaders(stationToken),
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

  finalizeUpload(stationToken: string, mediaId: string): Promise<FinalizeUploadResponseContract> {
    return this.request(`/stations/media/${encodeURIComponent(mediaId)}/finalize`, {
      method: 'POST',
      headers: this.stationHeaders(stationToken),
    });
  }
}
