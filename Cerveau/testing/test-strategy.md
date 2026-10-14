---
type: testing
statut: implémenté
verifie: 2026-10-14
commit: cd82ad8
sources: [backend/pyproject.toml, backend/config/settings_test.py, backend/conftest.py, backend/apps/noyau/tests/conftest.py, frontend/vite.config.js, frontend/playwright.config.js, .github/workflows/ci.yml]
---

# Stratégie de test

## Niveaux
| Niveau | Outil | Emplacement | Volume (2026-10-13) |
|---|---|---|---|
| Règles métier, API, sécurité | pytest + pytest-django | `backend/apps/noyau/tests/` | 206 tests exécutés (15 fichiers, dont `test_audit_securite.py` et `test_dates_inscription.py`) |
| Utilitaires et composants | Vitest + Testing Library (jsdom) | `frontend/tests/` | 12 fichiers, 52 tests |
| Parcours complet + accessibilité | Playwright + axe-core | `frontend/e2e/` | 3 tests |
| Lint / format | ruff · ESLint (jsx-a11y, react-hooks) + Prettier | — | — |
| Charge (manuel) | `infra/charge/charge.mjs`, `ws_charge.py` | `infra/charge/` | voir [deployment](../operations/deployment.md#tests-de-charge) |

## Configuration
- pytest : `config.settings_test` (cache local, Celery eager, emails en mémoire, hachage MD5 rapide, Channels en
  mémoire), `--reuse-db`. **Base MySQL réelle requise** (pas de SQLite). Les caches sont vidés avant chaque test.
- Cas de référence partagés JS/Python : `shared/token-fixtures.json` (dérivation des couleurs).
- Playwright : démarre son propre Django (port 8001, emails écrits dans `frontend/.emails-e2e/`, Celery
  synchrone) et Vite (port 5174) ; MySQL et Redis doivent tourner et `seed_demo` avoir été exécuté ; mots de passe
  lus dans `DEMO_MOT_DE_PASSE_*`.

## Intégration continue (`.github/workflows/ci.yml`)
À chaque push sur `main` et chaque pull request : backend (ruff + pytest sur MySQL 8), frontend (lint, Vitest,
build), puis e2e (MySQL + Redis, mots de passe de démo éphémères masqués, traces Playwright en artefact si échec).

## Dernière exécution locale connue
| Date | Contrôle | Résultat |
|---|---|---|
| 2026-10-13 | `npm test` | ✅ 52/52 (après la 2e code-review) |
| 2026-10-13 | `npm run lint` | ✅ |
| 2026-10-13 | `npm run build` | ✅ |
| 2026-10-13 | `ruff check` + `ruff format --check` | ✅ |
| 2026-10-13 | `pytest` sur MySQL | ⛔ non exécutable : MySQL injoignable (Docker arrêté) |
| 2026-10-14 | `pytest` sur SQLite en mémoire (réglages temporaires hors dépôt) | 206/207 ✅ ; seul échec : `test_concurrence_un_seul_emargement`, non exécutable sur SQLite (verrous entre threads) |
| 2026-10-13 | `npm run e2e` sur SQLite + relais Channels en mémoire (réglages temporaires) | ✅ 3/3 (parcours, temps réel, accessibilité axe-core) |
| 2026-10-13 | Parcours de la borne dans Chromium (caméra simulée, script hors dépôt) | ✅ 18/18 (verrou, retour, API refusées, recherche réduite, élévation, re-restriction après réglages et annulation, autre disposition depuis une borne) |

Mettre ce tableau à jour à chaque exécution significative.
