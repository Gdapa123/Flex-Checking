---
type: decision
statut: acceptée
verifie: 2026-10-13
commit: dc0c75a
sources: [PLAN.md, backend/apps/comptes/authentication.py, backend/apps/comptes/views.py, backend/config/settings.py]
---

# ADR-002 — Sessions : JWT en cookies httpOnly, CSRF, révocation par version de session

- **Date** : 2026-10-09 (PLAN §8) ; révocation ajoutée le 2026-10-12 (commit `bb226e9`)
- **Statut** : acceptée

## Contexte
Application web même origine (frontend et API derrière le même domaine), postes de scan partagés, besoin de
fermer les sessions à la désactivation d’un compte ou à un changement de mot de passe, WebSocket à authentifier.

## Options
1. Jetons dans `localStorage` + en-tête `Authorization` — exposés à toute faille XSS.
2. Sessions Django classiques — simples, mais moins adaptées à la rotation et au WebSocket ASGI.
3. **SimpleJWT dans des cookies httpOnly** + vérification CSRF.

## Décision
Option 3 : `fc_access` (15 min) et `fc_refresh` (12 h, rotation, liste noire, path `/api/auth/`), Secure,
SameSite=Lax ; CSRF exigé sur les requêtes modifiantes ; `version_session` portée par le jeton (`vs`) pour
révoquer toutes les sessions d’un compte.

## Conséquences
- ➕ jetons inaccessibles au JavaScript ; même cookie pour le WebSocket ; révocation immédiate.
- ➖ CSRF à gérer (`lib/api.js`) ; `JWT_COOKIE_SECURE=0` nécessaire en HTTP local hors localhost.
