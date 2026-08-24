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
| 6 — QA | Pas de test Globe, éléments SVG inaccessibles au clavier | Focus clavier, rôles ARIA, mouvement réduit, états vide/erreur, matrice desktop/tablette/mobile | CI lint/test/build |

## Scénarios de recette obligatoires

- OWNER en Suisse : la Suisse est colorée en or et la vue `Tout` est disponible.
- ADMIN : l’onglet `Tout` est absent et un appel direct `mode=all` retourne 403.
- Agent disponible avec zone partagée : point vert sélectionnable au clavier.
- Client connecté : losange cyan avec plan, stations et état de synchronisation.
- Relation active : courbe cliquable uniquement si l’assignation existe côté serveur.
- SLA à risque : courbe rouge et détail du dossier.
- Growth : aucun identifiant de visiteur n’est renvoyé ; seules des zones et étapes agrégées apparaissent.
- Absence de consentement ou de zone : aucun point n’est inventé.
- Natural Earth indisponible : océan, grille, points et message de fallback restent utilisables.
- 1 200 points proches : nombre de nœuds SVG réduit par clustering, sans perte d’élément.
- Mobile 320 px et tablette portrait : filtres déroulants, panneau de détail et contrôles restent accessibles.
