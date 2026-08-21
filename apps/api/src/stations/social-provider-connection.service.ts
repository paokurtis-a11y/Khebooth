import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation } from './station-auth.types';
import { SocialCredentialCipher } from './social-credential-cipher';
import { socialProviderReadiness, type KheSocialProvider } from './social-provider-readiness';

type OAuthProvider = 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'X' | 'YOUTUBE';
type ConnectionStatus = 'DISCONNECTED' | 'AUTHORIZING' | 'SELECTION_REQUIRED' | 'CONNECTED' | 'EXPIRED' | 'ERROR' | 'REVOKED';
type ConnectionRow = {
  organizationId: string;
  provider: KheSocialProvider;
  status: ConnectionStatus;
  externalAccountId: string | null;
  externalAccountName: string | null;
  accessTokenCiphertext: string | null;
  refreshTokenCiphertext: string | null;
  tokenExpiresAt: Date | null;
  scopes: string[];
  metadata: Record<string, unknown>;
  connectedAt: Date | null;
  lastValidatedAt: Date | null;
  lastError: string | null;
};
type OAuthStateRow = {
  organizationId: string;
  stationSessionId: string;
  provider: OAuthProvider;
  codeVerifierCiphertext: string | null;
};
type MetaPage = { id: string; name?: string; access_token?: string; instagram_business_account?: { id: string } };

const OAUTH_PROVIDERS = new Set<KheSocialProvider>(['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'X', 'YOUTUBE']);

@Injectable()
export class SocialProviderConnectionService {
  constructor(private readonly prisma: PrismaService, private readonly cipher: SocialCredentialCipher) {}

  private hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
  private graphVersion(): string { return process.env.META_GRAPH_API_VERSION?.trim() || 'v25.0'; }
  private callbackOrigin(): string {
    const explicit = process.env.SOCIAL_OAUTH_CALLBACK_ORIGIN?.trim();
    if (explicit) return explicit.replace(/\/$/, '');
    const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
    if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
    return 'http://localhost:3001';
  }
  callbackUrl(provider: OAuthProvider): string {
    return `${this.callbackOrigin()}/api/stations/social/oauth/${provider.toLowerCase()}/callback`;
  }

  private env(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new BadRequestException(`Configuration développeur incomplète : ${name}`);
    return value;
  }

  private async fetchJson<T>(url: string, init?: RequestInit, label = 'provider'): Promise<T> {
    const response = await fetch(url, init);
    if (!response.ok) throw new BadRequestException(`${label} a refusé la requête (${response.status})`);
    try { return await response.json() as T; }
    catch { throw new BadRequestException(`${label} a renvoyé une réponse invalide`); }
  }

  private async connection(organizationId: string, provider: KheSocialProvider): Promise<ConnectionRow | null> {
    const rows = await this.prisma.$queryRaw<ConnectionRow[]>`SELECT * FROM "SocialProviderConnection" WHERE "organizationId"=${organizationId}::uuid AND provider=${provider} LIMIT 1`;
    return rows[0] ?? null;
  }

  private async saveConnection(input: {
    organizationId: string; provider: KheSocialProvider; status: ConnectionStatus;
    externalAccountId?: string | null; externalAccountName?: string | null;
    accessToken?: string | null; refreshToken?: string | null; tokenExpiresAt?: Date | null;
    scopes?: string[]; metadata?: Record<string, unknown>; lastError?: string | null;
  }): Promise<void> {
    const access = input.accessToken === undefined ? undefined : this.cipher.encrypt(input.accessToken);
    const refresh = input.refreshToken === undefined ? undefined : this.cipher.encrypt(input.refreshToken);
    const existing = await this.connection(input.organizationId, input.provider);
    const metadata = JSON.stringify(input.metadata ?? {});
    const scopes = input.scopes ?? [];
    if (!existing) {
      await this.prisma.$executeRaw`INSERT INTO "SocialProviderConnection" (
        "organizationId",provider,status,"externalAccountId","externalAccountName","accessTokenCiphertext","refreshTokenCiphertext","tokenExpiresAt",scopes,metadata,"connectedAt","lastValidatedAt","lastError"
      ) VALUES (
        ${input.organizationId}::uuid,${input.provider},${input.status},${input.externalAccountId ?? null},${input.externalAccountName ?? null},${access ?? null},${refresh ?? null},${input.tokenExpiresAt ?? null},${scopes}::text[],${metadata}::jsonb,
        ${input.status === 'CONNECTED' ? new Date() : null},${input.status === 'CONNECTED' ? new Date() : null},${input.lastError ?? null}
      )`;
      return;
    }
    const nextAccess = access === undefined ? existing.accessTokenCiphertext : access;
    const nextRefresh = refresh === undefined ? existing.refreshTokenCiphertext : refresh;
    const nextId = input.externalAccountId === undefined ? existing.externalAccountId : input.externalAccountId;
    const nextName = input.externalAccountName === undefined ? existing.externalAccountName : input.externalAccountName;
    const nextExpiry = input.tokenExpiresAt === undefined ? existing.tokenExpiresAt : input.tokenExpiresAt;
    const nextScopes = input.scopes === undefined ? existing.scopes : scopes;
    const nextMetadata = input.metadata === undefined ? existing.metadata : input.metadata;
    await this.prisma.$executeRaw`UPDATE "SocialProviderConnection" SET
      status=${input.status},"externalAccountId"=${nextId},"externalAccountName"=${nextName},
      "accessTokenCiphertext"=${nextAccess},"refreshTokenCiphertext"=${nextRefresh},"tokenExpiresAt"=${nextExpiry},
      scopes=${nextScopes}::text[],metadata=${JSON.stringify(nextMetadata)}::jsonb,
      "connectedAt"=CASE WHEN ${input.status}='CONNECTED' THEN COALESCE("connectedAt",CURRENT_TIMESTAMP) ELSE "connectedAt" END,
      "disconnectedAt"=CASE WHEN ${input.status} IN ('DISCONNECTED','REVOKED') THEN CURRENT_TIMESTAMP ELSE NULL END,
      "lastValidatedAt"=CASE WHEN ${input.status}='CONNECTED' THEN CURRENT_TIMESTAMP ELSE "lastValidatedAt" END,
      "lastError"=${input.lastError ?? null},"updatedAt"=CURRENT_TIMESTAMP
      WHERE "organizationId"=${input.organizationId}::uuid AND provider=${input.provider}`;
  }

  async readiness(station: AuthenticatedStation, publicLinks: Record<string, string> = {}) {
    const base = socialProviderReadiness(publicLinks);
    const rows = await this.prisma.$queryRaw<ConnectionRow[]>`SELECT * FROM "SocialProviderConnection" WHERE "organizationId"=${station.organizationId}::uuid`;
    const byProvider = new Map(rows.map(row => [row.provider, row]));
    return base.map(item => {
      const row = byProvider.get(item.provider);
      const connected = row?.status === 'CONNECTED' && (!row.tokenExpiresAt || row.tokenExpiresAt.getTime() > Date.now());
      return {
        ...item,
        accountConnected: connected,
        automationReady: connected,
        connectionStatus: row?.status ?? 'DISCONNECTED',
        externalAccountId: row?.externalAccountId ?? null,
        externalAccountName: row?.externalAccountName ?? null,
        scopes: row?.scopes ?? [],
        tokenExpiresAt: row?.tokenExpiresAt ?? null,
        connectedAt: row?.connectedAt ?? null,
        lastValidatedAt: row?.lastValidatedAt ?? null,
        candidates: row?.status === 'SELECTION_REQUIRED' && Array.isArray(row.metadata?.candidates) ? row.metadata.candidates : [],
        callbackUrl: OAUTH_PROVIDERS.has(item.provider) ? this.callbackUrl(item.provider as OAuthProvider) : null,
      };
    });
  }

  async startOAuth(station: AuthenticatedStation, provider: KheSocialProvider) {
    if (!OAUTH_PROVIDERS.has(provider)) throw new BadRequestException(`${provider} n'utilise pas OAuth dans KHE`);
    const oauthProvider = provider as OAuthProvider;
    const state = randomBytes(32).toString('base64url');
    const verifier = oauthProvider === 'X' ? randomBytes(48).toString('base64url') : null;
    await this.prisma.$executeRaw`DELETE FROM "SocialOAuthState" WHERE "expiresAt"<CURRENT_TIMESTAMP OR "consumedAt" IS NOT NULL AND "createdAt"<CURRENT_TIMESTAMP-INTERVAL '1 hour'`;
    await this.prisma.$executeRaw`INSERT INTO "SocialOAuthState" ("organizationId","stationSessionId",provider,"stateHash","codeVerifierCiphertext","expiresAt") VALUES (${station.organizationId}::uuid,${station.sessionId}::uuid,${oauthProvider},${this.hash(state)},${this.cipher.encrypt(verifier)},CURRENT_TIMESTAMP+INTERVAL '10 minutes')`;
    await this.saveConnection({ organizationId: station.organizationId, provider, status: 'AUTHORIZING', lastError: null });
    const redirectUri = this.callbackUrl(oauthProvider);
    let authorizationUrl: URL;
    if (oauthProvider === 'FACEBOOK' || oauthProvider === 'INSTAGRAM') {
      const scopes = oauthProvider === 'FACEBOOK'
        ? ['pages_show_list','pages_read_engagement','pages_manage_posts']
        : ['pages_show_list','pages_read_engagement','instagram_basic','instagram_content_publish'];
      authorizationUrl = new URL(`https://www.facebook.com/${this.graphVersion()}/dialog/oauth`);
      authorizationUrl.search = new URLSearchParams({ client_id: this.env('META_APP_ID'), redirect_uri: redirectUri, state, response_type: 'code', scope: scopes.join(',') }).toString();
    } else if (oauthProvider === 'TIKTOK') {
      authorizationUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
      authorizationUrl.search = new URLSearchParams({ client_key: this.env('TIKTOK_CLIENT_KEY'), redirect_uri: redirectUri, state, response_type: 'code', scope: 'user.info.basic,video.publish' }).toString();
    } else if (oauthProvider === 'X') {
      const challenge = createHash('sha256').update(verifier!).digest('base64url');
      authorizationUrl = new URL('https://x.com/i/oauth2/authorize');
      authorizationUrl.search = new URLSearchParams({ response_type: 'code', client_id: this.env('X_CLIENT_ID'), redirect_uri: redirectUri, scope: 'tweet.read tweet.write users.read offline.access media.write', state, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
    } else {
      authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authorizationUrl.search = new URLSearchParams({ client_id: this.env('GOOGLE_OAUTH_CLIENT_ID'), redirect_uri: redirectUri, response_type: 'code', scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly', access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state }).toString();
    }
    return { provider: oauthProvider, authorizationUrl: authorizationUrl.toString(), callbackUrl: redirectUri, expiresInSeconds: 600 };
  }

  async oauthCallback(provider: KheSocialProvider, code: string, state: string) {
    if (!OAUTH_PROVIDERS.has(provider) || !code || !state) throw new BadRequestException('Callback OAuth incomplet');
    const oauthProvider = provider as OAuthProvider;
    const states = await this.prisma.$queryRaw<OAuthStateRow[]>`UPDATE "SocialOAuthState" SET "consumedAt"=CURRENT_TIMESTAMP WHERE "stateHash"=${this.hash(state)} AND provider=${oauthProvider} AND "consumedAt" IS NULL AND "expiresAt">CURRENT_TIMESTAMP RETURNING "organizationId","stationSessionId",provider,"codeVerifierCiphertext"`;
    const oauth = states[0];
    if (!oauth) throw new BadRequestException('État OAuth expiré ou déjà utilisé');
    try {
      if (oauthProvider === 'FACEBOOK' || oauthProvider === 'INSTAGRAM') return await this.finishMeta(oauth.organizationId, oauthProvider, code);
      if (oauthProvider === 'TIKTOK') return await this.finishTikTok(oauth.organizationId, code);
      if (oauthProvider === 'X') return await this.finishX(oauth.organizationId, code, this.cipher.decrypt(oauth.codeVerifierCiphertext));
      return await this.finishYouTube(oauth.organizationId, code);
    } catch (error) {
      await this.saveConnection({ organizationId: oauth.organizationId, provider: oauthProvider, status: 'ERROR', lastError: error instanceof Error ? error.message.slice(0, 180) : 'OAuth failed' });
      throw error;
    }
  }

  private async metaPages(userToken: string): Promise<{ pages: MetaPage[]; scopes: string[] }> {
    const version = this.graphVersion();
    const pages = await this.fetchJson<{ data?: MetaPage[] }>(`https://graph.facebook.com/${version}/me/accounts?fields=id,name,access_token,tasks,instagram_business_account&access_token=${encodeURIComponent(userToken)}`, undefined, 'Meta');
    const permissions = await this.fetchJson<{ data?: Array<{ permission: string; status: string }> }>(`https://graph.facebook.com/${version}/me/permissions?access_token=${encodeURIComponent(userToken)}`, undefined, 'Meta');
    return { pages: pages.data ?? [], scopes: (permissions.data ?? []).filter(item => item.status === 'granted').map(item => item.permission) };
  }

  private async finishMeta(organizationId: string, provider: 'FACEBOOK' | 'INSTAGRAM', code: string) {
    const redirectUri = this.callbackUrl(provider);
    const params = new URLSearchParams({ client_id: this.env('META_APP_ID'), client_secret: this.env('META_APP_SECRET'), redirect_uri: redirectUri, code });
    const token = await this.fetchJson<{ access_token?: string; expires_in?: number }>(`https://graph.facebook.com/${this.graphVersion()}/oauth/access_token?${params}`, undefined, 'Meta');
    if (!token.access_token) throw new BadRequestException('Meta n’a pas fourni de jeton utilisateur');
    const data = await this.metaPages(token.access_token);
    const eligible = provider === 'INSTAGRAM' ? data.pages.filter(page => page.instagram_business_account?.id) : data.pages;
    const candidates = eligible.map(page => ({ pageId: page.id, pageName: page.name ?? page.id, instagramAccountId: page.instagram_business_account?.id ?? null }));
    if (!eligible.length) throw new BadRequestException(provider === 'INSTAGRAM' ? 'Aucun compte Instagram professionnel lié à une Page gérée' : 'Aucune Page Facebook administrée trouvée');
    if (eligible.length === 1) return this.selectMetaPage(organizationId, provider, eligible[0].id, token.access_token, data.scopes, token.expires_in);
    await this.saveConnection({ organizationId, provider, status: 'SELECTION_REQUIRED', accessToken: token.access_token, refreshToken: null, tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null, scopes: data.scopes, metadata: { candidates } });
    return { provider, status: 'SELECTION_REQUIRED', candidates };
  }

  private async selectMetaPage(organizationId: string, provider: 'FACEBOOK' | 'INSTAGRAM', pageId: string, userToken?: string, knownScopes?: string[], expiresIn?: number) {
    const row = await this.connection(organizationId, provider);
    const token = userToken ?? this.cipher.decrypt(row?.accessTokenCiphertext);
    if (!token) throw new BadRequestException('Autorisation Meta à recommencer');
    const data = await this.metaPages(token);
    const page = data.pages.find(candidate => candidate.id === pageId);
    if (!page?.access_token) throw new NotFoundException('Page Meta introuvable ou non administrée');
    const scopes = knownScopes ?? data.scopes;
    if (provider === 'FACEBOOK') {
      await this.saveConnection({ organizationId, provider, status: 'CONNECTED', externalAccountId: page.id, externalAccountName: page.name ?? page.id, accessToken: page.access_token, refreshToken: null, tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : row?.tokenExpiresAt ?? null, scopes, metadata: { pageId: page.id } });
      return { provider, status: 'CONNECTED', externalAccountId: page.id, externalAccountName: page.name ?? page.id };
    }
    const igId = page.instagram_business_account?.id;
    if (!igId) throw new BadRequestException('Cette Page n’est pas liée à un compte Instagram professionnel');
    const identity = await this.fetchJson<{ id?: string; username?: string; name?: string }>(`https://graph.facebook.com/${this.graphVersion()}/${encodeURIComponent(igId)}?fields=id,username,name&access_token=${encodeURIComponent(page.access_token)}`, undefined, 'Instagram');
    await this.saveConnection({ organizationId, provider, status: 'CONNECTED', externalAccountId: identity.id ?? igId, externalAccountName: identity.username ? `@${identity.username}` : identity.name ?? page.name ?? igId, accessToken: page.access_token, refreshToken: null, tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : row?.tokenExpiresAt ?? null, scopes, metadata: { pageId: page.id, instagramAccountId: igId } });
    return { provider, status: 'CONNECTED', externalAccountId: identity.id ?? igId, externalAccountName: identity.username ? `@${identity.username}` : identity.name ?? igId };
  }

  async selectAccount(station: AuthenticatedStation, provider: KheSocialProvider, accountId: string) {
    if (provider !== 'FACEBOOK' && provider !== 'INSTAGRAM') throw new BadRequestException('Sélection de compte uniquement disponible pour Meta');
    return this.selectMetaPage(station.organizationId, provider, accountId);
  }

  private async finishTikTok(organizationId: string, code: string) {
    const body = new URLSearchParams({ client_key: this.env('TIKTOK_CLIENT_KEY'), client_secret: this.env('TIKTOK_CLIENT_SECRET'), code, grant_type: 'authorization_code', redirect_uri: this.callbackUrl('TIKTOK') });
    const token = await this.fetchJson<{ access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; open_id?: string }>('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }, 'TikTok');
    if (!token.access_token) throw new BadRequestException('TikTok n’a pas fourni de jeton');
    const identity = await this.fetchJson<{ data?: { user?: { open_id?: string; display_name?: string } } }>('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name', { headers: { Authorization: `Bearer ${token.access_token}` } }, 'TikTok');
    const user = identity.data?.user;
    const scopes = (token.scope ?? '').split(',').map(value => value.trim()).filter(Boolean);
    await this.saveConnection({ organizationId, provider: 'TIKTOK', status: 'CONNECTED', externalAccountId: user?.open_id ?? token.open_id ?? null, externalAccountName: user?.display_name ?? 'TikTok', accessToken: token.access_token, refreshToken: token.refresh_token ?? null, tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null, scopes });
    return { provider: 'TIKTOK', status: 'CONNECTED', externalAccountId: user?.open_id ?? token.open_id ?? null, externalAccountName: user?.display_name ?? 'TikTok' };
  }

  private async finishX(organizationId: string, code: string, verifier: string | null) {
    if (!verifier) throw new BadRequestException('PKCE X manquant');
    const clientId = this.env('X_CLIENT_ID'), secret = this.env('X_CLIENT_SECRET');
    const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: this.callbackUrl('X'), code_verifier: verifier });
    const token = await this.fetchJson<{ access_token?: string; refresh_token?: string; expires_in?: number; scope?: string }>('https://api.x.com/2/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}` }, body }, 'X');
    if (!token.access_token) throw new BadRequestException('X n’a pas fourni de jeton');
    const identity = await this.fetchJson<{ data?: { id?: string; name?: string; username?: string } }>('https://api.x.com/2/users/me?user.fields=name,username', { headers: { Authorization: `Bearer ${token.access_token}` } }, 'X');
    const user = identity.data;
    const scopes = (token.scope ?? '').split(/\s+/).filter(Boolean);
    await this.saveConnection({ organizationId, provider: 'X', status: 'CONNECTED', externalAccountId: user?.id ?? null, externalAccountName: user?.username ? `@${user.username}` : user?.name ?? 'X', accessToken: token.access_token, refreshToken: token.refresh_token ?? null, tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null, scopes });
    return { provider: 'X', status: 'CONNECTED', externalAccountId: user?.id ?? null, externalAccountName: user?.username ? `@${user.username}` : user?.name ?? 'X' };
  }

  private async finishYouTube(organizationId: string, code: string) {
    const body = new URLSearchParams({ client_id: this.env('GOOGLE_OAUTH_CLIENT_ID'), client_secret: this.env('GOOGLE_OAUTH_CLIENT_SECRET'), code, grant_type: 'authorization_code', redirect_uri: this.callbackUrl('YOUTUBE') });
    const token = await this.fetchJson<{ access_token?: string; refresh_token?: string; expires_in?: number; scope?: string }>('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }, 'Google');
    if (!token.access_token) throw new BadRequestException('Google n’a pas fourni de jeton');
    const channels = await this.fetchJson<{ items?: Array<{ id?: string; snippet?: { title?: string } }> }>('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true', { headers: { Authorization: `Bearer ${token.access_token}` } }, 'YouTube');
    const channel = channels.items?.[0];
    if (!channel?.id) throw new BadRequestException('Aucune chaîne YouTube trouvée pour ce compte Google');
    const scopes = (token.scope ?? '').split(/\s+/).filter(Boolean);
    await this.saveConnection({ organizationId, provider: 'YOUTUBE', status: 'CONNECTED', externalAccountId: channel.id, externalAccountName: channel.snippet?.title ?? 'YouTube', accessToken: token.access_token, refreshToken: token.refresh_token ?? null, tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null, scopes });
    return { provider: 'YOUTUBE', status: 'CONNECTED', externalAccountId: channel.id, externalAccountName: channel.snippet?.title ?? 'YouTube' };
  }

  async validateServerProvider(station: AuthenticatedStation, provider: KheSocialProvider) {
    if (provider === 'WHATSAPP') {
      const token = this.env('META_WHATSAPP_ACCESS_TOKEN'), phoneId = this.env('META_WHATSAPP_PHONE_NUMBER_ID');
      const identity = await this.fetchJson<{ id?: string; display_phone_number?: string; verified_name?: string }>(`https://graph.facebook.com/${this.graphVersion()}/${encodeURIComponent(phoneId)}?fields=id,display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${token}` } }, 'WhatsApp');
      await this.saveConnection({ organizationId: station.organizationId, provider, status: 'CONNECTED', externalAccountId: identity.id ?? phoneId, externalAccountName: identity.verified_name ?? identity.display_phone_number ?? 'WhatsApp Business', accessToken: null, refreshToken: null, scopes: ['whatsapp_business_messaging'], metadata: { phoneNumberId: phoneId, displayPhoneNumber: identity.display_phone_number ?? null } });
      return { provider, status: 'CONNECTED', externalAccountId: identity.id ?? phoneId, externalAccountName: identity.verified_name ?? identity.display_phone_number ?? 'WhatsApp Business' };
    }
    if (provider === 'TELEGRAM') {
      const token = this.env('TELEGRAM_BOT_TOKEN'), chatId = this.env('TELEGRAM_TARGET_CHAT_ID');
      const bot = await this.fetchJson<{ ok?: boolean; result?: { id?: number; username?: string; first_name?: string } }>(`https://api.telegram.org/bot${token}/getMe`, undefined, 'Telegram');
      const chat = await this.fetchJson<{ ok?: boolean; result?: { id?: number; title?: string; username?: string; type?: string } }>(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`, undefined, 'Telegram');
      if (!bot.ok || !bot.result?.id || !chat.ok || !chat.result?.id) throw new BadRequestException('Bot Telegram ou canal cible non vérifiable');
      await this.saveConnection({ organizationId: station.organizationId, provider, status: 'CONNECTED', externalAccountId: String(bot.result.id), externalAccountName: bot.result.username ? `@${bot.result.username}` : bot.result.first_name ?? 'Telegram Bot', accessToken: null, refreshToken: null, scopes: ['bot.send'], metadata: { targetChatId: String(chat.result.id), targetChatName: chat.result.title ?? chat.result.username ?? null, targetChatType: chat.result.type ?? null } });
      return { provider, status: 'CONNECTED', externalAccountId: String(bot.result.id), externalAccountName: bot.result.username ? `@${bot.result.username}` : bot.result.first_name ?? 'Telegram Bot' };
    }
    throw new BadRequestException('Utilisez OAuth pour ce fournisseur');
  }

  async disconnect(station: AuthenticatedStation, provider: KheSocialProvider) {
    const row = await this.connection(station.organizationId, provider);
    if (!row) return { provider, status: 'DISCONNECTED' };
    await this.prisma.$executeRaw`UPDATE "SocialProviderConnection" SET status='REVOKED',"accessTokenCiphertext"=NULL,"refreshTokenCiphertext"=NULL,"tokenExpiresAt"=NULL,"disconnectedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${station.organizationId}::uuid AND provider=${provider}`;
    return { provider, status: 'REVOKED' };
  }
}
