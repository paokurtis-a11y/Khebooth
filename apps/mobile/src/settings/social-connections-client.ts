import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config';
import type { SocialProvider } from '../api/station-api';

const STATION_TOKEN_KEY = 'khe.station.token.v1';

export type SocialConnectionStatus = 'DISCONNECTED' | 'AUTHORIZING' | 'SELECTION_REQUIRED' | 'CONNECTED' | 'EXPIRED' | 'ERROR' | 'REVOKED';
export interface SocialConnectionCandidate { pageId: string; pageName: string; instagramAccountId?: string | null; }
export interface SocialConnectionReadiness {
  provider: SocialProvider;
  mode: 'OAUTH' | 'SERVER_TOKEN' | 'BOT_TOKEN';
  publicLinkConfigured: boolean;
  developerConfigReady: boolean;
  accountConnected: boolean;
  automationReady: boolean;
  connectionStatus: SocialConnectionStatus;
  externalAccountId: string | null;
  externalAccountName: string | null;
  scopes: string[];
  tokenExpiresAt: string | null;
  connectedAt: string | null;
  lastValidatedAt: string | null;
  candidates: SocialConnectionCandidate[];
  callbackUrl: string | null;
  missingEnvironmentVariables: string[];
  action: string;
  security: string;
}

interface ReadinessResponse { generatedAt: string; providers: SocialConnectionReadiness[]; }

async function parseError(response: Response): Promise<Error> {
  try {
    const payload = await response.json() as { message?: string | string[] };
    const message = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message;
    return new Error(message || `HTTP ${response.status}`);
  } catch { return new Error(`HTTP ${response.status}`); }
}

export class SocialConnectionsClient {
  private url(path: string): string { return `${API_BASE_URL.replace(/\/$/, '')}${path}`; }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let token = await SecureStore.getItemAsync(STATION_TOKEN_KEY);
    if (!token) throw new Error('Session SHARING introuvable. Réactivez la station.');
    const execute = (value: string) => fetch(this.url(path), {
      ...init,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers ?? {}), Authorization: `Bearer ${value}` },
    });
    let response = await execute(token);
    if (response.status === 401) {
      const renewed = await fetch(this.url('/stations/renew'), { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      if (!renewed.ok) throw await parseError(renewed);
      const renewal = await renewed.json() as { stationToken?: string };
      if (!renewal.stationToken) throw new Error('Renouvellement SHARING incomplet.');
      token = renewal.stationToken;
      await SecureStore.setItemAsync(STATION_TOKEN_KEY, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      response = await execute(token);
    }
    if (!response.ok) throw await parseError(response);
    return await response.json() as T;
  }

  readiness() { return this.request<ReadinessResponse>('/stations/social/readiness'); }
  start(provider: SocialProvider) { return this.request<{ provider: SocialProvider; authorizationUrl: string; callbackUrl: string; expiresInSeconds: number }>(`/stations/social/oauth/${provider.toLowerCase()}/start`, { method: 'POST' }); }
  select(provider: SocialProvider, accountId: string) { return this.request<{ provider: SocialProvider; status: SocialConnectionStatus; externalAccountName?: string }>(`/stations/social/oauth/${provider.toLowerCase()}/select`, { method: 'POST', body: JSON.stringify({ accountId }) }); }
  validate(provider: SocialProvider) { return this.request<{ provider: SocialProvider; status: SocialConnectionStatus; externalAccountName?: string }>(`/stations/social/${provider.toLowerCase()}/validate`, { method: 'POST' }); }
  disconnect(provider: SocialProvider) { return this.request<{ provider: SocialProvider; status: SocialConnectionStatus }>(`/stations/social/${provider.toLowerCase()}/disconnect`, { method: 'POST' }); }
}
