import { PrismaService } from '../src/prisma/prisma.service';
import { SocialCredentialCipher } from '../src/stations/social-credential-cipher';
import { SocialProviderConnectionService } from '../src/stations/social-provider-connection.service';

describe('KHE social provider OAuth security', () => {
  const station = { sessionId:'11111111-1111-4111-8111-111111111111', organizationId:'22222222-2222-4222-8222-222222222222', eventId:'33333333-3333-4333-8333-333333333333', deviceId:'44444444-4444-4444-8444-444444444444', mode:'SHARING' as any };
  const prisma = { $executeRaw: jest.fn(), $queryRaw: jest.fn() } as unknown as PrismaService;
  let cipher: SocialCredentialCipher;
  let service: SocialProviderConnectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret-with-enough-entropy-for-social-encryption';
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = '';
    process.env.SOCIAL_OAUTH_CALLBACK_ORIGIN = 'https://khebooth-api.vercel.app';
    process.env.X_CLIENT_ID = 'x-client-id';
    process.env.X_CLIENT_SECRET = 'x-client-secret-private';
    process.env.META_APP_ID = 'meta-app-id';
    process.env.META_APP_SECRET = 'meta-app-secret-private';
    process.env.TIKTOK_CLIENT_KEY = 'tiktok-client-key';
    process.env.TIKTOK_CLIENT_SECRET = 'tiktok-secret-private';
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'google-secret-private';
    (prisma.$executeRaw as jest.Mock).mockResolvedValue(1);
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
    cipher = new SocialCredentialCipher();
    service = new SocialProviderConnectionService(prisma, cipher);
  });

  it('encrypts provider credentials with authenticated encryption and round-trips them', () => {
    const raw = 'refresh-token-that-must-never-be-plain';
    const encrypted = cipher.encrypt(raw);
    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain(raw);
    expect(cipher.decrypt(encrypted)).toBe(raw);
  });

  it('builds X Authorization Code + PKCE without leaking the client secret', async () => {
    const result = await service.startOAuth(station, 'X');
    const url = new URL(result.authorizationUrl);
    expect(url.origin).toBe('https://x.com');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('x-client-id');
    expect(url.searchParams.get('scope')).toContain('tweet.write');
    expect(url.searchParams.get('scope')).toContain('offline.access');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(result.authorizationUrl).not.toContain('x-client-secret-private');
    expect(result.callbackUrl).toBe('https://khebooth-api.vercel.app/api/stations/social/oauth/x/callback');
  });

  it('uses the minimum Meta scopes required by the selected KHE connection', async () => {
    const facebook = await service.startOAuth(station, 'FACEBOOK');
    const facebookScopes = new URL(facebook.authorizationUrl).searchParams.get('scope') ?? '';
    expect(facebookScopes).toContain('pages_manage_posts');
    expect(facebookScopes).not.toContain('instagram_content_publish');

    const instagram = await service.startOAuth(station, 'INSTAGRAM');
    const instagramScopes = new URL(instagram.authorizationUrl).searchParams.get('scope') ?? '';
    expect(instagramScopes).toContain('instagram_basic');
    expect(instagramScopes).toContain('instagram_content_publish');
    expect(instagram.authorizationUrl).not.toContain('meta-app-secret-private');
  });

  it('never starts OAuth for server-token providers', async () => {
    await expect(service.startOAuth(station, 'WHATSAPP')).rejects.toThrow(/n'utilise pas OAuth/);
    await expect(service.startOAuth(station, 'TELEGRAM')).rejects.toThrow(/n'utilise pas OAuth/);
  });
});
