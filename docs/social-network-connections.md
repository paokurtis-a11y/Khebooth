# KHE Booth — Connexions développeur des réseaux sociaux

KHE Booth ne stocke jamais les mots de passe Instagram, Facebook, TikTok, X, Google/YouTube ou Telegram. Les connexions utilisent OAuth ou des jetons techniques serveur. Les access/refresh tokens OAuth sont chiffrés côté API avec AES-256-GCM avant stockage PostgreSQL et ne sont jamais renvoyés au mobile.

## Callbacks à enregistrer dans les portails développeurs

Production API KHE : `https://khebooth-api.vercel.app`

- Facebook : `https://khebooth-api.vercel.app/api/stations/social/oauth/facebook/callback`
- Instagram : `https://khebooth-api.vercel.app/api/stations/social/oauth/instagram/callback`
- TikTok : `https://khebooth-api.vercel.app/api/stations/social/oauth/tiktok/callback`
- X : `https://khebooth-api.vercel.app/api/stations/social/oauth/x/callback`
- Google / YouTube : `https://khebooth-api.vercel.app/api/stations/social/oauth/youtube/callback`

Les URI doivent être copiées exactement dans les consoles développeur. En preview/local, définir `SOCIAL_OAUTH_CALLBACK_ORIGIN` avec l'origine HTTPS autorisée correspondante.

## Variables serveur

Variables non secrètes :
- `META_GRAPH_API_VERSION` (défaut KHE : `v25.0`)
- `SOCIAL_OAUTH_CALLBACK_ORIGIN` (facultatif sur Vercel si `VERCEL_PROJECT_PRODUCTION_URL` est le domaine API canonique)

Secret de chiffrement :
- `SOCIAL_TOKEN_ENCRYPTION_KEY` recommandé. S'il est absent, KHE dérive une clé spécifique depuis `JWT_SECRET`. Une rotation de la source de clé nécessite de reconnecter les fournisseurs dont les tokens ont été chiffrés avec l'ancienne clé.

Secrets/app IDs :
- Meta : `META_APP_ID`, `META_APP_SECRET`
- WhatsApp Cloud API : `META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`
- TikTok : `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`
- X : `X_CLIENT_ID`, `X_CLIENT_SECRET`
- Telegram : `TELEGRAM_BOT_TOKEN`, `TELEGRAM_TARGET_CHAT_ID`
- Google/YouTube : `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`

Aucune valeur secrète ne doit être commitée dans GitHub.

## Flux KHE par fournisseur

### Facebook
KHE utilise Meta OAuth et demande uniquement `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`. Après autorisation, KHE lit les Pages administrées. S'il y en a plusieurs, SHARING affiche un choix explicite avant de stocker le Page Access Token chiffré.

### Instagram
KHE utilise le compte Instagram professionnel lié à une Page gérée par le compte Meta et demande `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`. Si plusieurs profils professionnels sont disponibles, aucun choix n'est effectué automatiquement.

### WhatsApp Business
KHE ne demande pas le mot de passe WhatsApp. Le token Cloud API et le Phone Number ID sont des secrets serveur. Le bouton « Vérifier » appelle Meta en lecture afin de confirmer le numéro et le nom vérifié avant de considérer la connexion active. Aucun message test n'est envoyé automatiquement pendant cette validation.

### TikTok
KHE utilise OAuth Web v2 avec `state` anti-CSRF. Scopes demandés : `user.info.basic` et `video.publish`. Le compte doit avoir autorisé ces scopes et l'application TikTok doit avoir été approuvée pour Content Posting API. KHE valide l'identité distante après échange du code et conserve access/refresh tokens chiffrés côté serveur.

### X
KHE utilise OAuth 2.0 Authorization Code + PKCE S256. Scopes : `tweet.read`, `tweet.write`, `users.read`, `media.write`, `offline.access`. Le `code_verifier` est chiffré dans un état OAuth valable dix minutes. `offline.access` permet d'obtenir un refresh token pour éviter de redemander une connexion toutes les deux heures.

### Telegram
Le Bot Token reste serveur. KHE appelle `getMe` puis `getChat` pour confirmer le bot et le canal/groupe cible. Aucun message n'est envoyé lors de la validation.

### YouTube
KHE utilise Google OAuth Web Server et demande `youtube.upload` + `youtube.readonly`, avec accès offline et consentement. Après OAuth, KHE vérifie qu'une chaîne existe via `channels.list?mine=true`. Les tokens sont chiffrés côté serveur.

## États visibles dans SHARING

- `CONFIGURATION DÉVELOPPEUR REQUISE` : au moins une variable serveur est absente.
- `PRÊT À CONNECTER` : OAuth peut être lancé.
- `AUTORISATION EN COURS` : KHE attend le callback de la plateforme.
- `CHOIX DU COMPTE` : plusieurs Pages/profils Meta sont disponibles et l'utilisateur doit en choisir un.
- `CONNECTÉ ✓` : l'identité distante a été validée et le token est stocké côté serveur.
- `À RECONNECTER` : le fournisseur a refusé/expiré l'autorisation.

Un lien public dans SHARING n'est jamais interprété comme une autorisation API.

## Sécurité et exploitation

- État OAuth aléatoire, haché en base, valable dix minutes et consommable une seule fois.
- X utilise PKCE S256.
- Tokens OAuth chiffrés AES-256-GCM ; aucun token en clair dans les logs ou réponses mobiles.
- Les Page Access Tokens Meta ne sont jamais inclus dans la liste de comptes affichée au mobile.
- La déconnexion KHE efface les tokens locaux chiffrés. Une révocation complète peut aussi être faite dans la plateforme concernée.
- Une connexion technique ne vaut pas consentement d'un invité à recevoir, publier ou faire du marketing : les consentements SocialDeliverySession existants restent séparés.
- L'activation des publications/DM automatiques doit être validée fournisseur par fournisseur après connexion, scopes et éventuel App Review/audit.
