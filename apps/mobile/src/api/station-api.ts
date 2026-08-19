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

export type SocialProvider = 'WHATSAPP' | 'TIKTOK' | 'FACEBOOK' | 'INSTAGRAM' | 'X' | 'TELEGRAM' | 'YOUTUBE';
export type SharingGalleryLayout = 'MASONRY' | 'GRID' | 'COMPACT';
export type SharingMediaFit = 'COVER' | 'CONTAIN';

export interface SharingBusinessSettingsContract {
  socialLinks: Partial<Record<SocialProvider, string>>;
  galleryLayout: SharingGalleryLayout;
  portraitColumns: number;
  landscapeColumns: number;
  videoAutoplay: boolean;
  mediaFit: SharingMediaFit;
  updatedAt: string | Date;
}

export interface SocialShareContract {
  id: string;
  mediaId: string;
  provider: SocialProvider;
  shareUrl: string;
  createdAt: string | Date;
  capability: {
    messageDelivery: boolean;
    directPublishing: boolean;
    followVerification: string;
  };
}

export interface StationProfileContract {
  organizationId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  company: string;
  role: string;
  email: string;
  phone: string;
  address: string;
  birthDate: string | Date | null;
  avatarPath: string | null;
  city: string;
  country: string;
  bio: string;
  updatedAt: string | Date;
}

export type StationProfileUpdate = Omit<StationProfileContract, 'organizationId' | 'updatedAt' | 'avatarPath'>;

export interface ProfileAvatarUploadTicket {
  pathname: string;
  uploadUrl: string;
  expiresAt: string | Date;
  contentType: string;
  byteSize: number;
}

export interface ProfileAvatarDownloadTicket {
  pathname: string | null;
  downloadUrl: string | null;
  expiresAt: string | Date | null;
  contentType?: string;
  byteSize?: number;
}

export interface DesignBackgroundUploadTicket {
  pathname: string;
  uploadUrl: string;
  expiresAt: string | Date;
  contentType: string;
  byteSize: number;
}

export interface DesignBackgroundDownloadTicket {
  pathname: string;
  downloadUrl: string;
  expiresAt: string | Date;
  contentType: string;
  byteSize: number;
}

export interface ClientEventContract {
  id: string;
  name: string;
  description: string | null;
  startsAt: string | Date;
  endsAt: string | Date | null;
  status: string;
  clientId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ClientWorkspaceContract {
  clientId: string;
  plan: string;
  entitlements: Record<string, boolean>;
  currentEventId: string;
  selectedEvent: ClientEventContract | null;
  designConfig: Record<string, unknown>;
  designReadyAt: string | Date | null;
  shouldSwitch: boolean;
  events: ClientEventContract[];
}

export interface CreateClientEventRequest {
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
}

export interface CreateClientEventResponse {
  event: ClientEventContract;
  plan: string;
  entitlements: Record<string, boolean>;
  nextStep: 'STUDIO' | 'READY';
}

export interface SwitchedStationResponse extends StationRedeemResponseContract {
  designConfig?: Record<string, unknown>;
}

export interface NotificationPreferencesContract {
  enabled: boolean;
  soundEnabled: boolean;
  sound: string;
  soundVolume: number;
  vibrationEnabled: boolean;
  vibrationMode: string;
  vibrationIntensity: string;
}

/** Core contract used by offline media/sync tests and low-level station features. */
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

/** Extended client-facing station contract used by Profile, Settings and SHARING workspace. */
export interface StationExperienceApi extends StationApi {
  requestControlConnection(stationToken: string): Promise<StationControlContract>;
  respondControlConnection(stationToken: string, accepted: boolean): Promise<StationControlContract>;
  disconnectControlConnection(stationToken: string): Promise<StationControlContract>;
  profile(stationToken: string): Promise<StationProfileContract>;
  updateProfile(stationToken: string, profile: StationProfileUpdate): Promise<StationProfileContract>;
  prepareProfileAvatarUpload(stationToken: string, contentType: string, byteSize: number): Promise<ProfileAvatarUploadTicket>;
  confirmProfileAvatar(stationToken: string, pathname: string): Promise<{ pathname: string; confirmed: boolean }>;
  profileAvatarDownload(stationToken: string): Promise<ProfileAvatarDownloadTicket>;
  notificationPreferences(stationToken: string): Promise<NotificationPreferencesContract>;
  updateNotificationPreferences(stationToken: string, preferences: NotificationPreferencesContract): Promise<NotificationPreferencesContract>;
  clientWorkspace(stationToken: string): Promise<ClientWorkspaceContract>;
  createClientEvent(stationToken: string, event: CreateClientEventRequest): Promise<CreateClientEventResponse>;
  markClientEventDesignReady(stationToken: string, eventId: string, designConfig: Record<string, unknown>): Promise<void>;
  prepareDesignBackgroundUpload(stationToken: string, eventId: string, contentType: string, byteSize: number): Promise<DesignBackgroundUploadTicket>;
  designBackgroundDownload(stationToken: string, pathname: string): Promise<DesignBackgroundDownloadTicket>;
  switchClientEvent(stationToken: string, eventId: string): Promise<SwitchedStationResponse>;
  sharingBusinessSettings(stationToken: string): Promise<SharingBusinessSettingsContract>;
  updateSharingBusinessSettings(stationToken: string, settings: Partial<SharingBusinessSettingsContract>): Promise<SharingBusinessSettingsContract>;
  createSocialShare(stationToken: string, mediaId: string, provider: SocialProvider): Promise<SocialShareContract>;
  deleteSharingMedia(stationToken: string, mediaId: string): Promise<{ id: string; deleted: boolean }>;
}

class StationApiHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'StationApiHttpError';
  }
}

export class HttpStationApi implements StationExperienceApi {
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
        const payload = await response.json() as { message?: string | string[] };
        if (Array.isArray(payload.message)) message = payload.message.join(', ');
        else if (payload.message) message = payload.message;
      } catch {}
      throw new StationApiHttpError(response.status, message);
    }
    return await response.json() as T;
  }

  private async renewToken(stationToken: string): Promise<string> {
    const current = this.resolvedToken(stationToken);
    if (!this.renewalPromise) {
      this.renewalPromise = this.request<StationRedeemResponseContract>('/stations/renew', {
        method: 'POST',
        headers: { Authorization: `Bearer ${current}` },
      }).then(async (response) => {
        this.renewedTokens.set(stationToken, response.stationToken);
        this.renewedTokens.set(current, response.stationToken);
        await SecureStore.setItemAsync(STATION_TOKEN_KEY, response.stationToken, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
        return response.stationToken;
      }).finally(() => { this.renewalPromise = null; });
    }
    return this.renewalPromise;
  }

  private async stationRequest<T>(path: string, stationToken: string, init?: RequestInit): Promise<T> {
    const execute = (token: string) => this.request<T>(path, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
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

  redeem(request: StationRedeemRequestContract) { return this.request<StationRedeemResponseContract>('/stations/redeem', { method: 'POST', body: JSON.stringify(request) }); }
  manifest(token: string) { return this.stationRequest<EventManifestContract>('/stations/manifest', token); }
  liveSession(token: string) { return this.stationRequest<StationLiveSessionContract>('/stations/live-session', token); }
  control(token: string) { return this.stationRequest<StationControlContract>('/stations/control', token); }
  requestControlConnection(token: string) { return this.stationRequest<StationControlContract>('/stations/control/connection-request', token, { method: 'POST' }); }
  respondControlConnection(token: string, accepted: boolean) { return this.stationRequest<StationControlContract>('/stations/control/connection-response', token, { method: 'PATCH', body: JSON.stringify({ accepted }) }); }
  disconnectControlConnection(token: string) { return this.stationRequest<StationControlContract>('/stations/control/disconnect', token, { method: 'POST' }); }
  updateControlCommand(token: string, command: StationControlCommandContract) { return this.stationRequest<StationControlContract>('/stations/control/command', token, { method: 'PATCH', body: JSON.stringify(command) }); }
  updateControlStatus(token: string, status: StationControlStatusContract) { return this.stationRequest<StationControlContract>('/stations/control/status', token, { method: 'PATCH', body: JSON.stringify(status) }); }
  profile(token: string) { return this.stationRequest<StationProfileContract>('/stations/profile', token); }
  updateProfile(token: string, profile: StationProfileUpdate) { return this.stationRequest<StationProfileContract>('/stations/profile', token, { method: 'PATCH', body: JSON.stringify(profile) }); }
  prepareProfileAvatarUpload(token: string, contentType: string, byteSize: number) { return this.stationRequest<ProfileAvatarUploadTicket>('/stations/profile/avatar-upload', token, { method: 'POST', body: JSON.stringify({ contentType, byteSize }) }); }
  confirmProfileAvatar(token: string, pathname: string) { return this.stationRequest<{ pathname: string; confirmed: boolean }>('/stations/profile/avatar-confirm', token, { method: 'POST', body: JSON.stringify({ pathname }) }); }
  profileAvatarDownload(token: string) { return this.stationRequest<ProfileAvatarDownloadTicket>('/stations/profile/avatar-download', token); }
  notificationPreferences(token: string) { return this.stationRequest<NotificationPreferencesContract>('/stations/notification-preferences', token); }
  updateNotificationPreferences(token: string, preferences: NotificationPreferencesContract) { return this.stationRequest<NotificationPreferencesContract>('/stations/notification-preferences', token, { method: 'PATCH', body: JSON.stringify(preferences) }); }
  clientWorkspace(token: string) { return this.stationRequest<ClientWorkspaceContract>('/stations/client-workspace', token); }
  createClientEvent(token: string, event: CreateClientEventRequest) { return this.stationRequest<CreateClientEventResponse>('/stations/client-events', token, { method: 'POST', body: JSON.stringify(event) }); }
  async markClientEventDesignReady(token: string, eventId: string, designConfig: Record<string, unknown>): Promise<void> { await this.stationRequest<ClientWorkspaceContract>(`/stations/client-events/${encodeURIComponent(eventId)}/design-ready`, token, { method: 'POST', body: JSON.stringify({ designConfig }) }); }
  prepareDesignBackgroundUpload(token: string, eventId: string, contentType: string, byteSize: number) { return this.stationRequest<DesignBackgroundUploadTicket>(`/stations/client-events/${encodeURIComponent(eventId)}/design-background-upload`, token, { method: 'POST', body: JSON.stringify({ contentType, byteSize }) }); }
  designBackgroundDownload(token: string, pathname: string) { return this.stationRequest<DesignBackgroundDownloadTicket>('/stations/design-background-download', token, { method: 'POST', body: JSON.stringify({ pathname }) }); }
  async switchClientEvent(token: string, eventId: string) {
    const current = this.resolvedToken(token);
    const response = await this.stationRequest<SwitchedStationResponse>(`/stations/client-events/${encodeURIComponent(eventId)}/switch`, current, { method: 'POST' });
    this.renewedTokens.set(token, response.stationToken);
    this.renewedTokens.set(current, response.stationToken);
    await SecureStore.setItemAsync(STATION_TOKEN_KEY, response.stationToken, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return response;
  }
  sharingBusinessSettings(token: string) { return this.stationRequest<SharingBusinessSettingsContract>('/stations/sharing-business-settings', token); }
  updateSharingBusinessSettings(token: string, settings: Partial<SharingBusinessSettingsContract>) { return this.stationRequest<SharingBusinessSettingsContract>('/stations/sharing-business-settings', token, { method: 'PATCH', body: JSON.stringify(settings) }); }
  createSocialShare(token: string, id: string, provider: SocialProvider) { return this.stationRequest<SocialShareContract>(`/stations/media/${encodeURIComponent(id)}/social-share`, token, { method: 'POST', body: JSON.stringify({ provider }) }); }
  deleteSharingMedia(token: string, id: string) { return this.stationRequest<{ id: string; deleted: boolean }>(`/stations/media/${encodeURIComponent(id)}`, token, { method: 'DELETE' }); }
  listMedia(token: string) { return this.stationRequest<MediaAssetContract[]>('/stations/media', token); }
  createMedia(token: string, media: SyntheticMediaCreateContract) { return this.stationRequest<MediaAssetContract>('/stations/media', token, { method: 'POST', body: JSON.stringify(media) }); }
  prepareBlobUpload(token: string, id: string) { return this.stationRequest<BlobUploadTicketContract & { alreadyUploaded?: boolean }>(`/stations/media/${encodeURIComponent(id)}/blob-upload`, token, { method: 'POST' }); }
  mediaDownload(token: string, id: string) { return this.stationRequest<MediaDownloadTicketContract>(`/stations/media/${encodeURIComponent(id)}/download`, token); }
  createMediaShare(token: string, id: string) { return this.stationRequest<MediaShareContract>(`/stations/media/${encodeURIComponent(id)}/share`, token, { method: 'POST' }); }
  revokeMediaShare(token: string, id: string) { return this.stationRequest<{ id: string; revoked: boolean }>(`/stations/shares/${encodeURIComponent(id)}/revoke`, token, { method: 'POST' }); }
  initializeUpload(token: string, id: string) { return this.stationRequest<UploadSessionContract>(`/stations/media/${encodeURIComponent(id)}/upload`, token, { method: 'POST' }); }
  updateUpload(token: string, id: string, uploadedBytes: number) { return this.stationRequest<UploadSessionContract>(`/stations/media/${encodeURIComponent(id)}/upload`, token, { method: 'PATCH', body: JSON.stringify({ uploadedBytes }) }); }
  finalizeUpload(token: string, id: string) { return this.stationRequest<FinalizeUploadResponseContract>(`/stations/media/${encodeURIComponent(id)}/finalize`, token, { method: 'POST' }); }
}
