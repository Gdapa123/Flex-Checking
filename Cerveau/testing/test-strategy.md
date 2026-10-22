---
type: testing
statut: implémenté
verifie: 2026-10-22
commit: be899ff
sources: [backend/apps/noyau/tests/test_durcissement.py, frontend/tests/fileHorsLigne.test.js, backend/pyproject.toml, backend/config/settings_test.py, backend/conftest.py, backend/apps/noyau/tests/, frontend/vite.config.js, frontend/package.json, frontend/playwright.config.js, frontend/tests/, .github/workflows/ci.yml]
---

# Stratégie de test

## Niveaux
| Niveau | Outil | Emplacement | Volume |
|---|---|---|---|
| Règles métier, API, sécurité | pytest + pytest-django | `backend/apps/noyau/tests/` | 19 fichiers, **264 tests exécutés** le 2026-10-22 (dont `test_donnees_personnelles.py` ; 257 lors de l'audit du matin) (paramétrages compris ; 242 collectés le 2026-10-21), dont `test_durcissement.py`, `test_audit_securite.py`, `test_dates_inscription.py`, `test_suivi_emails.py` et `test_sondage.py` ; `backend/apps/comptes/tests/` ne contient aucun test |
| Utilitaires et composants | Vitest + Testing Library (jsdom) | `frontend/tests/` | 16 fichiers, **68 tests** exécutés le 2026-10-22 (dont `confidentialite.test.jsx`) (dont `fileHorsLigne.test.js`, 2) |
| Parcours complet + accessibilité | Playwright + axe-core | `frontend/e2e/` | 3 tests (2 fichiers : `parcours.spec.js` 2, `accessibilite.spec.js` 1) |
| Lint / format | ruff · ESLint (jsx-a11y, react-hooks) + Prettier | — | — |
| Charge (manuel) | `infra/charge/charge.mjs`, `ws_charge.py` | `infra/charge/` | voir [deployment](../operations/deployment.md#tests-de-charge) |

## Configuration
- Vitest 5 et Vite 7 (`frontend/package.json`) ; le serveur de développement Vite ne sert que `frontend/` et
  `../shared` (`server.fs.allow`).
- pytest : `config.settings_test` (cache local, Celery eager, emails en mémoire, hachage MD5 rapide, Channels en
  mémoire), `--reuse-db`. **Base MySQL réelle requise** (pas de SQLite). Les caches sont vidés avant chaque test.
- Cas de référence partagés JS/Python : `shared/token-fixtures.json` (dérivation des couleurs).
- Playwright : démarre son propre Django (port 8001, emails écrits dans `frontend/.emails-e2e/`, Celery
  synchrone) et Vite (port 5174) ; MySQL et Redis doivent tourner et `seed_demo` avoir été exécuté ; mots de passe
  lus dans `DEMO_MOT_DE_PASSE_*`.

## Intégration continue (`.github/workflows/ci.yml`)
À chaque push sur `main` et chaque pull request : backend (ruff + pytest sur MySQL 8), frontend (lint, Vitest,
build), puis e2e (MySQL + Redis, mots de passe de démo éphémères masqués, traces Playwright en artefact si échec).
Python 3.12, Node.js 24 ; actions GitHub en v7 (`checkout`, `setup-python`, `setup-node`, `upload-artifact`),
qui tournent sur Node.js 24 (les v4/v5 sur Node.js 20 déclenchaient un avertissement d’obsolescence).

## Dernière exécution locale connue
| Date | Contrôle | Résultat |
|---|---|---|
| 2026-10-22 | `pytest` sur MySQL 8 (Docker) | ✅ **257 passed** (après l'audit de durcissement) |
| 2026-10-22 | `ruff check` + `ruff format --check` | ✅ |
| 2026-10-22 | `npm test` (Vitest) | ✅ 66/66 (15 fichiers) |
| 2026-10-22 | `npm run lint` (ESLint + Prettier) | ✅ |
| 2026-10-22 | `npm run build` | ✅ |
| 2026-10-22 | `npm run e2e` (après `migrate` + `seed_demo`) | ✅ 3/3 (parcours, temps réel, accessibilité axe-core) |
| 2026-10-14 | `npm test` | ✅ 64/64 (après l'audit de sécurité) |
| 2026-10-13 | `npm run lint` | ✅ |
| 2026-10-13 | `npm run build` | ✅ |
| 2026-10-13 | `ruff check` + `ruff format --check` | ✅ |
| 2026-10-13 | `pytest` sur MySQL | ⛔ non exécutable : MySQL injoignable (Docker arrêté) |
| 2026-10-14 | `pytest` sur SQLite en mémoire (réglages temporaires hors dépôt) | 241/242 ✅ ; seul échec : `test_concurrence_un_seul_emargement`, non exécutable sur SQLite (verrous entre threads) |
| 2026-10-14 | `npm run e2e` sur SQLite + relais Channels en mémoire (réglages temporaires) | ✅ 3/3 (parcours, temps réel, accessibilité axe-core) |
| 2026-10-14 | Parcours de la borne dans Chromium, compte super admin (caméra simulée, script hors dépôt) | ✅ 18/18 (verrou, retour, API refusées, recherche réduite, élévation, re-restriction après réglages et annulation, autre disposition depuis une borne) |

Mettre ce tableau à jour à chaque exécution significative.

Le 2026-10-21, après la refactorisation non commitée de `frontend/e2e/parcours.spec.js` (aides
`evenementPmdOuvert` / `urlInvites`, étapes en `test.step`, fixtures `browser` / `baseURL`), seuls ESLint + Prettier
et `playwright test --list` (3 tests listés) ont été exécutés sur ce fichier ; **l'e2e n'a pas été exécuté** (MySQL et
Redis arrêtés). Aucune ligne n'est donc ajoutée au tableau pour ce changement. Ce parcours refactorisé a été
exécuté avec succès le 2026-10-22 (ligne `npm run e2e` ci-dessus).

CI : depuis le 2026-10-22, le jeton `GITHUB_TOKEN` du workflow est limité à `permissions: contents: read`.
