---
type: decision
statut: acceptée
verifie: 2026-10-21
commit: be899ff
sources: [PLAN.md, backend/apps/comptes/authentication.py, backend/apps/comptes/views.py, backend/apps/comptes/permissions.py, backend/apps/noyau/consumers.py, backend/config/settings.py, frontend/src/lib/api.js]
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

## Mise en œuvre (vérifiée au commit `be899ff`)
- `CookieJWTAuthentication` (`backend/apps/comptes/authentication.py`) lit `fc_access`, refuse un compte inactif,
  un jeton à version de session périmée (`jeton_revoque`) ou révoqué à la déconnexion (`acces_revoque`), puis
  vérifie le CSRF (`verifier_csrf`).
- Compléments postérieurs à la décision, sans la remettre en cause :
  - **déconnexion** : le jeton d'accès est révoqué jusqu'à son expiration (`revoquer_acces`, jti en cache), en plus
    de la liste noire du refresh ; les autres appareils du compte restent connectés ;
  - **claim `borne`** ([ADR-010](ADR-010-mode-borne-serveur.md)) portée par le jeton et conservée au rafraîchissement ;
  - **rafraîchissement** (2026-10-14, `RafraichirView`) : CSRF désormais exigé, comme la connexion et la
    déconnexion ; `lib/api.js` envoie `X-CSRFToken` ; jeton verrouillé (`select_for_update` sur `OutstandingToken`)
    pour qu'un même refresh ne soit pas utilisé deux fois en parallèle ;
  - cookie signé `fc_poste` (90 jours, path `/api/auth/`) qui dispense un poste connu du blocage par compte
    (voir [authentification](../features/authentification.md)).
- Le WebSocket est authentifié par le même cookie (`backend/apps/noyau/consumers.py`).

## Conséquences
- ➕ jetons inaccessibles au JavaScript ; même cookie pour le WebSocket ; révocation immédiate.
- ➖ CSRF à gérer (`lib/api.js`) ; `JWT_COOKIE_SECURE=0` nécessaire en HTTP local hors localhost.
