import { socialProviderReadiness } from '../src/stations/social-provider-readiness';

describe('socialProviderReadiness', () => {
  const names = [
    'META_APP_ID',
    'META_APP_SECRET',
    'META_WHATSAPP_ACCESS_TOKEN',
    'META_WHATSAPP_PHONE_NUMBER_ID',
    'TIKTOK_CLIENT_KEY',
    'TIKTOK_CLIENT_SECRET',
    'X_CLIENT_ID',
    'X_CLIENT_SECRET',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_TARGET_CHAT_ID',
    'GOOGLE_OAUTH_CLIENT_ID',
    'GOOGLE_OAUTH_CLIENT_SECRET',
  ];

  const previous = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const name of names) {
      previous.set(name, process.env[name]);
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const name of names) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    previous.clear();
  });

  it('reports developer setup as required and never claims a real account is connected', () => {
    const providers = socialProviderReadiness({ INSTAGRAM: 'https://instagram.com/khebooth' });
    const instagram = providers.find((entry) => entry.provider === 'INSTAGRAM');

    expect(instagram).toMatchObject({
      publicLinkConfigured: true,
      developerConfigReady: false,
      accountConnected: false,
      automationReady: false,
      status: 'DEVELOPER_SETUP_REQUIRED',
    });
    expect(instagram?.missingEnvironmentVariables).toEqual(['META_APP_ID', 'META_APP_SECRET']);
    expect(JSON.stringify(providers)).not.toContain('access-token');
    expect(JSON.stringify(providers)).not.toContain('client-secret-value');
  });

  it('moves OAuth providers to READY_TO_CONNECT only when their developer credentials exist', () => {
    process.env.TIKTOK_CLIENT_KEY = 'client-key-value';
    process.env.TIKTOK_CLIENT_SECRET = 'client-secret-value';

    const tiktok = socialProviderReadiness().find((entry) => entry.provider === 'TIKTOK');
    expect(tiktok).toMatchObject({
      developerConfigReady: true,
      accountConnected: false,
      automationReady: false,
      status: 'READY_TO_CONNECT',
    });
    expect(tiktok?.missingEnvironmentVariables).toEqual([]);
    expect(JSON.stringify(tiktok)).not.toContain('client-key-value');
    expect(JSON.stringify(tiktok)).not.toContain('client-secret-value');
  });

  it('treats Telegram and WhatsApp as server-side credential flows, not social-password flows', () => {
    process.env.TELEGRAM_BOT_TOKEN = 'bot-secret';
    process.env.TELEGRAM_TARGET_CHAT_ID = '-100123456789';
    process.env.META_WHATSAPP_ACCESS_TOKEN = 'wa-secret';
    process.env.META_WHATSAPP_PHONE_NUMBER_ID = '123456789';

    const providers = socialProviderReadiness();
    const telegram = providers.find((entry) => entry.provider === 'TELEGRAM');
    const whatsapp = providers.find((entry) => entry.provider === 'WHATSAPP');

    expect(telegram).toMatchObject({ mode: 'BOT_TOKEN', status: 'SERVER_CREDENTIALS_READY', accountConnected: false });
    expect(whatsapp).toMatchObject({ mode: 'SERVER_TOKEN', status: 'SERVER_CREDENTIALS_READY', accountConnected: false });
    expect(JSON.stringify({ telegram, whatsapp })).not.toContain('bot-secret');
    expect(JSON.stringify({ telegram, whatsapp })).not.toContain('wa-secret');
  });
});
