---
type: feature
statut: implémenté
verifie: 2026-10-14
commit: 36389e6
sources: [backend/apps/comptes/, backend/config/settings.py, frontend/src/lib/api.js, frontend/src/features/auth/]
---

# Authentification, sessions et droits

## Rôles
| Rôle | Accès |
|---|---|
| `SUPER_ADMIN` | tout ; espaces `/super`, `/admin`, `/scan` |
| `ADMIN` | `/admin` et `/scan`, **limité aux cérémonies affectées** (`evenements_visibles`) |
| invité | aucun compte ; espace public seulement |

## Connexion (`POST /api/auth/connexion/`)
- Email + mot de passe (Argon2) ; compte inactif = identifiants invalides (401, message unique).
- **CSRF exigé** (`verifier_csrf` au début de la vue, qui n'a pas d'authentification DRF) : pas de connexion forcée
  depuis un autre site. API en **JSON uniquement** (plus de `MultiPartParser`) : un formulaire posté d'ailleurs → 415.
- **Email ASCII uniquement** : la collation MySQL `utf8mb4_unicode_ci` confond « mdé.ci » et « mde.ci » ; sans ce
  refus, chaque variante accentuée aurait eu ses propres compteurs (force brute illimitée).
- Pose `fc_access` (15 min, path `/`) et `fc_refresh` (12 h, path `/api/auth/`), httpOnly, Secure, SameSite=Lax,
  plus le cookie CSRF `fc_csrftoken` (lisible par le JS).
- Limites : 5/min par (IP + email) ; 30/min par IP toutes adresses confondues (`LIMITE_CONNEXION_IP`) ;
  **20 échecs/h par compte visé** (`cle_echecs_connexion`) : chaque essai est compté avant la vérification du mot de
  passe (incrément atomique, pas de contournement par requêtes parallèles) et une connexion réussie remet la série à
  zéro ; le verrouillage n'intervient qu'après 20 échecs d'affilée.
- **Poste connu** (2026-10-14) : après une connexion réussie, cookie signé `fc_poste` (httpOnly, 90 jours, path
  `/api/auth/`, empreintes des comptes, 10 au plus). Un poste connu n'est **pas** soumis au blocage par compte : un
  tiers qui accumule des échecs sur l'email d'un hôte ne peut plus le bloquer le jour J. Cookie infalsifiable
  (`signing`), limite par IP + email inchangée.
- **Rafraîchissement** (`auth/rafraichir/`) : CSRF exigé (le frontend envoie `X-CSRFToken`) ; jeton verrouillé
  (`select_for_update` sur `OutstandingToken`) : deux rafraîchissements simultanés n'ouvrent pas deux sessions.
- Champ mot de passe avec bouton « Afficher / Masquer » (`Champ`, aussi dans le changement de mot de passe).
- Deux écrans : `/connexion` (admin, redirection selon le rôle) et `/super/connexion` (univers MDE).
- Retour après connexion vers `state.depuis`, filtré par `cheminInterne` (pas de redirection ouverte).

## Requêtes
- `CookieJWTAuthentication` : lit `fc_access`, refuse compte désactivé et jeton révoqué, **vérifie le CSRF** sur
  les requêtes modifiantes ; `lib/api.js` envoie `X-CSRFToken` et appelle `/api/auth/csrf/` si besoin.
- 401 → `lib/api.js` tente `/auth/rafraichir/` une fois (rotation + liste noire), sinon émet `fc:session-expiree`.
- Permission par défaut `CompteUtilisable` : connecté, actif et **sorti du mot de passe temporaire** ; seuls
  `auth/moi/` et `auth/mot-de-passe/` déclarent `IsAuthenticated`.

## Déconnexion
Refresh mis en liste noire **et jeton d'accès révoqué** jusqu'à son expiration (`revoquer_acces`, jti en cache des
limites) : un jeton volé ne sert plus, y compris pour le WebSocket. Les autres appareils du compte restent connectés.

## Session « borne libre-service » ([ADR-010](../decisions/ADR-010-mode-borne-serveur.md))
`POST auth/borne/` réémet les jetons avec la claim `borne` (conservée au rafraîchissement). `CompteUtilisable` refuse
alors toute vue qui ne déclare pas `autorise_borne` (403 « Action réservée à l’hôte ») : seuls l'émargement, la
recherche réduite, les réglages du scan, les compteurs (sans noms) et la liste des cérémonies restent accessibles ;
changement de mot de passe interdit. `POST auth/verifier-mot-de-passe/` (5/min, 30/h par compte) rend une session
complète ; `auth/moi/` renvoie `borne`.

## Révocation des sessions
`Admin.version_session` est copiée dans le jeton (`vs`). Changement ou réinitialisation du mot de passe →
incrément → tous les jetons antérieurs refusés (API, rafraîchissement, WebSocket). Une mise à niveau silencieuse
du hachage ne la modifie pas ; un jeton sans `vs` vaut 0.

## Mot de passe temporaire
Créé par le super admin (`XXXX-XXXX-XXXX`, alphabet sans caractères ambigus), affiché une fois.
`RequireRole` affiche `ChangerMotDePasse` tant que `doitChangerMotDePasse` est vrai (10 caractères minimum,
validateurs Django), avec une sortie « Ce n’est pas mon compte · Se déconnecter ».
« Mot de passe oublié ? » : message renvoyant vers la direction des événements.

## Garde de route frontend (`RequireRole`)
Seul un 401 déconnecte ; une panne réseau ou serveur affiche « Connexion au serveur impossible · Réessayer », et
sur `/scan` garde le dernier compte connu ([hors-ligne](hors-ligne.md)).

## Tests
`test_permissions.py`, `test_securite.py`, `frontend/tests/garde.test.jsx`, `connexion.test.js`.
Décisions : [ADR-002](../decisions/ADR-002-jwt-cookies-httponly.md), [ADR-003](../decisions/ADR-003-comptes-mot-de-passe-temporaire.md).
