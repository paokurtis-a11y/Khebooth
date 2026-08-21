# KHE Booth — Connexions réseaux sociaux

KHE Booth ne doit jamais stocker les mots de passe des comptes sociaux. Les comptes restent protégés par leurs plateformes. KHE utilise uniquement OAuth ou des jetons techniques côté serveur, avec les permissions minimales nécessaires.

## Identité recommandée

Nom public : **KHE Booth**

Handles à essayer dans cet ordre :
1. `@khebooth`
2. `@kheboothapp`
3. `@khe.booth`
4. `@khebooth.events`

Ne considérer un handle comme acquis qu’après création réelle du compte sur la plateforme.

## Matrice de connexion

| Réseau | Mode KHE | Prérequis externe | Secrets KHE serveur |
| --- | --- | --- | --- |
| WhatsApp | Cloud API | Meta Business + numéro WhatsApp Business | `META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID` |
| Instagram | OAuth | Compte professionnel + application Meta | `META_APP_ID`, `META_APP_SECRET` |
| Facebook | OAuth | Page Facebook + application Meta | `META_APP_ID`, `META_APP_SECRET` |
| TikTok | OAuth | Compte TikTok + application TikTok for Developers + Content Posting API | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` |
| X | OAuth | Compte X + projet/app Developer avec écriture | `X_CLIENT_ID`, `X_CLIENT_SECRET` |
| Telegram | Bot API | Bot BotFather + droits sur canal/groupe | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_TARGET_CHAT_ID` |
| YouTube | OAuth | Chaîne YouTube + projet Google Cloud + YouTube Data API | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` |

## Règles de sécurité

- Aucun mot de passe social dans PostgreSQL, l’APK, le navigateur ou les logs.
- Aucun access token ou refresh token renvoyé au mobile.
- Les secrets fournisseur vivent uniquement dans les variables serveur Vercel/secret store.
- Toute publication ou messagerie automatique doit rester désactivée tant que la plateforme n’a pas réellement autorisé KHE.
- Un simple lien public Instagram/Facebook/etc. ne vaut jamais autorisation API.
- Les consentements client de réception, publication et marketing restent séparés.
- Les scopes OAuth doivent être les plus restrictifs possibles.

## État attendu dans KHE

KHE expose pour chaque réseau :
- lien public configuré ou non ;
- configuration développeur prête ou non ;
- type de connexion (OAuth / token serveur / bot) ;
- variables serveur encore manquantes ;
- action suivante ;
- état d’automatisation.

Tant qu’un vrai compte n’est pas autorisé ou vérifié, `accountConnected` et `automationReady` restent `false`.
