export type KheSocialProvider = 'WHATSAPP' | 'TIKTOK' | 'FACEBOOK' | 'INSTAGRAM' | 'X' | 'TELEGRAM' | 'YOUTUBE';
export type KheSocialConnectionMode = 'OAUTH' | 'SERVER_TOKEN' | 'BOT_TOKEN';
export type KheSocialReadinessStatus = 'DEVELOPER_SETUP_REQUIRED' | 'READY_TO_CONNECT' | 'SERVER_CREDENTIALS_READY';

export interface SocialProviderReadiness {
  provider: KheSocialProvider;
  mode: KheSocialConnectionMode;
  publicLinkConfigured: boolean;
  developerConfigReady: boolean;
  accountConnected: false;
  automationReady: false;
  status: KheSocialReadinessStatus;
  missingEnvironmentVariables: string[];
  action: string;
  security: string;
}

interface Definition {
  provider: KheSocialProvider;
  mode: KheSocialConnectionMode;
  env: string[];
  readyAction: string;
  setupAction: string;
}

const DEFINITIONS: Definition[] = [
  {
    provider: 'WHATSAPP',
    mode: 'SERVER_TOKEN',
    env: ['META_WHATSAPP_ACCESS_TOKEN', 'META_WHATSAPP_PHONE_NUMBER_ID'],
    readyAction: 'Identifiants WhatsApp Cloud API présents côté serveur. Vérifier le numéro et le compte Business avant d’activer les envois.',
    setupAction: 'Créer/valider Meta Business + WhatsApp Cloud API puis enregistrer le token et le Phone Number ID dans les secrets serveur.',
  },
  {
    provider: 'INSTAGRAM',
    mode: 'OAUTH',
    env: ['META_APP_ID', 'META_APP_SECRET'],
    readyAction: 'Application Meta prête. Le compte Instagram professionnel devra encore autoriser KHE via OAuth.',
    setupAction: 'Créer l’application Meta et activer les produits/permissions Instagram nécessaires avant l’autorisation OAuth.',
  },
  {
    provider: 'FACEBOOK',
    mode: 'OAUTH',
    env: ['META_APP_ID', 'META_APP_SECRET'],
    readyAction: 'Application Meta prête. La Page Facebook devra encore autoriser KHE via OAuth.',
    setupAction: 'Créer l’application Meta et activer les permissions Page nécessaires avant l’autorisation OAuth.',
  },
  {
    provider: 'TIKTOK',
    mode: 'OAUTH',
    env: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
    readyAction: 'Application TikTok prête. Le compte devra encore autoriser KHE et les scopes de publication approuvés.',
    setupAction: 'Créer l’application TikTok for Developers et demander Content Posting API / scopes requis.',
  },
  {
    provider: 'X',
    mode: 'OAUTH',
    env: ['X_CLIENT_ID', 'X_CLIENT_SECRET'],
    readyAction: 'Application X prête. Le compte devra encore autoriser KHE avec un jeton utilisateur.',
    setupAction: 'Créer un projet/app X Developer avec permissions d’écriture et OAuth utilisateur.',
  },
  {
    provider: 'TELEGRAM',
    mode: 'BOT_TOKEN',
    env: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_TARGET_CHAT_ID'],
    readyAction: 'Bot Telegram configuré côté serveur. Vérifier qu’il est autorisé à publier dans le canal/groupe cible.',
    setupAction: 'Créer le bot avec BotFather, l’ajouter au canal/groupe et enregistrer son token + chat ID dans les secrets serveur.',
  },
  {
    provider: 'YOUTUBE',
    mode: 'OAUTH',
    env: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'],
    readyAction: 'Client Google OAuth prêt. La chaîne YouTube devra encore autoriser KHE avant tout upload.',
    setupAction: 'Créer un projet Google Cloud, activer YouTube Data API et configurer un client OAuth.',
  },
];

function present(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export function socialProviderReadiness(publicLinks: Record<string, string> = {}): SocialProviderReadiness[] {
  return DEFINITIONS.map((definition) => {
    const missingEnvironmentVariables = definition.env.filter((name) => !present(name));
    const developerConfigReady = missingEnvironmentVariables.length === 0;
    return {
      provider: definition.provider,
      mode: definition.mode,
      publicLinkConfigured: Boolean(publicLinks[definition.provider]?.trim()),
      developerConfigReady,
      accountConnected: false,
      automationReady: false,
      status: developerConfigReady
        ? definition.mode === 'OAUTH' ? 'READY_TO_CONNECT' : 'SERVER_CREDENTIALS_READY'
        : 'DEVELOPER_SETUP_REQUIRED',
      missingEnvironmentVariables,
      action: developerConfigReady ? definition.readyAction : definition.setupAction,
      security: 'KHE ne renvoie jamais de secret, mot de passe, access token ou refresh token au client mobile.',
    };
  });
}
