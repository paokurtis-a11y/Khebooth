# Globe KHE 2.0 — audit phases 0 à 6

Ce contrôle traduit le cahier des charges fonctionnel du 24 août 2026 en exigences vérifiables par la CI.

| Phase | Écart constaté sur `main` | Correction de cette branche | Preuve attendue |
| --- | --- | --- | --- |
| 0 — Fondation | Contrat non paramétré, types DB libres, vue `all` non protégée par rôle, ancienne zone conservée après révocation | Validation stricte `mode/window`, normalisation ISO-2, cache par organisation, révocation effective du partage, `all` refusé aux non-OWNER côté API | Tests unitaires API |
| 1 — Agents + OWNER | Aucun filtre de statut ou pays, clic pays sans filtrage | Filtres locaux, drill-down pays/KPI, pays OWNER, panneau basculable | TypeScript + contrôle statique QA |
| 2 — Clients | Plan, événement actif, stations et synchro absents du globe | Agrégat SQL unique : abonnement, CAPTURE/SHARING, médias, événements, zone approximative | CI API + build Web |
| 3 — Relations | Une seule couleur et aucune information SLA | Relations serveur réelles uniquement, canal/priorité/SLA, ligne rouge en risque et fiche accessible | Tests de contrat + contrôle UI |
| 4 — Growth | Points orange uniformes et résumé non affiché | Étapes Visiteur/Engagé/Lead/Prospect/Client, agrégats consentis et pseudonymisés, KPI de conversion | Test de confidentialité + build |
| 5 — Performance | Rechargement de toutes les couches, aucun clustering, rotation par intervalle | Chargement par couche, cache 10 s, clustering grille, limite de labels, animation `requestAnimationFrame` | Test synthétique de 1 200 points |
| 6 — QA | Pas de test Globe, éléments SVG inaccessibles au clavier | Focus clavier, rôles ARIA, mouvement réduit, états vide/erreur non bloquants, gestes tactiles 360°, matrice desktop/tablette/mobile | CI lint/test/build |

## Scénarios de recette obligatoires

- OWNER en Suisse : la Suisse est colorée en or et la vue `Tout` est disponible.
- ADMIN interne KHE : l’onglet `Tout` est absent et un appel direct `mode=all` retourne 403.
- Compte géré BUSINESS/ENTERPRISE actif, payé et non expiré : accès à sa propre fiche, à ses relations et uniquement aux agents réellement affectés à ses conversations.
- Compte géré BUSINESS/ENTERPRISE : les modes Growth et `Tout`, les autres clients et l’historique complet des agents restent inaccessibles.
- Compte BUSINESS/ENTERPRISE inactif, impayé ou expiré : l’API Globe retourne 403.
- Agent disponible avec zone partagée : point vert sélectionnable au clavier.
- Client connecté : losange cyan avec plan, stations et état de synchronisation.
- Relation active : courbe cliquable uniquement si l’assignation existe côté serveur.
- SLA à risque : courbe rouge et détail du dossier.
- Growth : aucun identifiant de visiteur n’est renvoyé ; seules des zones et étapes agrégées apparaissent.
- Absence de consentement ou de zone : aucun point n’est inventé.
- Natural Earth indisponible : océan, grille, points et message de fallback restent utilisables.
- 1 200 points proches : nombre de nœuds SVG réduit par clustering, sans perte d’élément.
- Zone dense : toucher un groupe ouvre une liste défilante des agents ou clients ; chaque ligne ouvre ensuite la fiche individuelle et ses moyens de contact.
- Mobile 320 px et tablette portrait : filtres déroulants, panneau de détail et contrôles restent accessibles.
- Glisser sur le globe : rotation horizontale et verticale sans ouvrir accidentellement une fiche.
- Pincer, double-toucher ou utiliser la molette : zoom continu borné entre la vue mondiale et la commune.
- Toucher un agent, client, point Growth ou relation : fiche visible ; touches répétées : continent → pays → commune.
- Couche vide : l'information reste discrète sous le globe et ne masque jamais la carte.
- Fiche agent/client/relation : e-mail et téléphone ouvrent la messagerie ou l'appel ; OWNER/ADMIN internes voient l’organisation, un compte BUSINESS/ENTERPRISE ne voit que son périmètre géré.
- Couche météo : activation, masquage, pause/reprise des animations, rotation et zoom restent fluides sur iPhone.
- Météo mondiale : les coordonnées représentatives sont chargées par lots de 40, mises en cache 10 minutes et seules les zones visibles sont dessinées.
- Avant production : configurer `OPEN_METEO_API_URL` et `OPEN_METEO_API_KEY` avec une licence commerciale, ou une instance Open-Meteo auto-hébergée.
