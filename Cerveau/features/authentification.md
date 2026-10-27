---
type: feature
statut: implémenté
verifie: 2026-10-26
commit: 2523cbb
sources: [backend/apps/noyau/vues_admin.py, backend/apps/noyau/consumers.py, backend/apps/noyau/tests/test_durcissement.py, backend/apps/noyau/tests/test_temps_reel.py, backend/apps/comptes/views.py, backend/apps/comptes/authentication.py, backend/apps/comptes/permissions.py, backend/apps/comptes/throttles.py, backend/config/settings.py, frontend/src/lib/api.js, frontend/src/features/auth/useMoi.js, frontend/src/features/auth/RequireRole.jsx, backend/apps/noyau/tests/test_audit_securite.py, frontend/src/App.jsx]
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
- **IPv6 regroupée par /64** (`throttles.ident_reseau`, 2026-10-14) : toutes les limites par IP (`LimiteSensible` et
  la limite anonyme globale `AnonymeThrottle`, `LIMITE_ANONYME`) comptent une adresse IPv6 par son préfixe /64 (une
  IPv4 mappée `::ffff:…` redevient l'IPv4) ; sinon un client changerait d'adresse à chaque essai.
- Longueurs bornées : email 254, mots de passe 256 caractères (connexion, changement, vérification).
- **Poste connu** (2026-10-14, durci le 2026-10-22) : après une connexion réussie, cookie signé `fc_poste`
  (httpOnly, 90 jours, path `/api/auth/`, empreintes des comptes, 10 au plus). Un poste connu a **son propre
  compteur** d'échecs (`cle_echecs_connexion(email) + ":poste-connu"`, 20/h) : un tiers qui accumule des échecs sur
  l'email d'un hôte ne peut pas le bloquer le jour J, mais les essais depuis ce poste (tablette perdue, borne
  partagée) restent limités (auparavant illimités). Une connexion réussie remet les deux compteurs à zéro. Cookie
  infalsifiable (`signing`), limite par IP + email inchangée.
- **Rafraîchissement** (`auth/rafraichir/`) : CSRF exigé (le frontend envoie `X-CSRFToken`) ; jeton verrouillé
  (`select_for_update` sur `OutstandingToken`) : deux rafraîchissements simultanés n'ouvrent pas deux sessions.
  **Postgres** (2026-10-26, non commité) : la requête verrouillée est triée par `pk` ; le tri par défaut du modèle
  (`user`, clé nullable) ajoutait une jointure externe que Postgres refuse de verrouiller (`FOR UPDATE cannot be
  applied to the nullable side of an outer join`), soit une erreur 500 à chaque rafraîchissement sur Vercel + Neon
  (MySQL l'accepte). Constaté en lançant la suite pytest sur Postgres : 6 tests en échec avant, 267/267 après.
  **Onglets simultanés** (2026-10-22) : si le jeton refusé est authentique (signature et expiration vérifiées) et a
  été révoqué il y a moins de 30 s (`DELAI_COURSE_RAFRAICHISSEMENT_S`) par une rotation (un jeton plus récent du compte
  émis dans la fenêtre de cette rotation, de 2 s avant à 5 s après la révocation : une nouvelle connexion sur un
  autre appareil ne suffit pas, depuis `7e0e071`), `RafraichirView` répond 409 `SESSION_DEJA_RENOUVELEE` **sans effacer les cookies**
  (`_renouvele_par_un_autre_onglet`) ; une déconnexion ou une révocation n'émettant pas de nouveau jeton reste un
  401 `SESSION_EXPIREE`.
- Champ mot de passe avec bouton « Afficher / Masquer » (`Champ`, aussi dans le changement de mot de passe).
- Deux écrans : `/connexion` (admin, redirection selon le rôle) et `/super/connexion` (univers MDE).
- Retour après connexion vers `state.depuis`, filtré par `cheminInterne` (pas de redirection ouverte).
- `oublierMoi` (`useMoi.js`, appelé sur 401 et à la déconnexion) efface aussi l'historique du poste de scan en
  `sessionStorage` (`fc-scan-historique-*`, `fc-scan-dernier-*`) : aucun nom d'invité ne reste sur une tablette partagée.

## Requêtes
- `CookieJWTAuthentication` : lit `fc_access`, refuse compte désactivé et jeton révoqué, **vérifie le CSRF** sur
  les requêtes modifiantes ; `lib/api.js` envoie `X-CSRFToken` et appelle `/api/auth/csrf/` si besoin.
- 401 → `lib/api.js` tente `/auth/rafraichir/` une fois (rotation + liste noire ; un 409 compte comme un succès,
  les cookies de l'autre onglet étant en place) ; sinon, **ou si la requête rejouée reçoit encore 401**, émet
  `fc:session-expiree`.
- Permission par défaut `CompteUtilisable` : connecté, actif et **sorti du mot de passe temporaire** ; seuls
  `auth/moi/` et `auth/mot-de-passe/` déclarent `IsAuthenticated`.

## Déconnexion
Refresh mis en liste noire **et jeton d'accès révoqué** jusqu'à son expiration (`revoquer_acces`, jti en cache des
limites) : un jeton volé ne sert plus, y compris pour le WebSocket. Depuis `7e0e071`, la vue envoie au groupe du compte
(`temps_reel.groupe_compte`) le message `session_fermee` portant le jti du jeton d'accès :
`TempsReelConsumer.session_fermee` ne ferme (4001) que la connexion temps réel ouverte avec ce jeton. Les autres
appareils du compte restent connectés et ne sont pas sollicités (ils comparent seulement le jti).

## Session « borne libre-service » ([ADR-010](../decisions/ADR-010-mode-borne-serveur.md))
`POST auth/borne/` réémet les jetons avec la claim `borne` (conservée au rafraîchissement). `CompteUtilisable` refuse
alors toute vue qui ne déclare pas `autorise_borne` (403 « Action réservée à l’hôte ») : seuls l'émargement, la
recherche réduite, les réglages du scan, les compteurs (sans noms) et la liste des cérémonies restent accessibles ;
changement de mot de passe interdit. `POST auth/verifier-mot-de-passe/` (5/min, 30/h par compte) rend une session
complète ; `auth/moi/` renvoie `borne`.

## Révocation des sessions
`Admin.version_session` est copiée dans le jeton (`vs`). Changement ou réinitialisation du mot de passe, ou
**désactivation du compte** (`AdminViewSet.perform_update`, `nouvelle_version_session`, 2026-10-22 : les sessions
ne revivent pas si le compte est réactivé avant leur expiration) →
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
Prop `precharger` (depuis `43f99c5`) : le code de l'espace (admin, scan, super admin) est téléchargé en parallèle de
`/auth/moi/` ; ce code est public et ne contient aucune donnée, un échec est ignoré (le chargement normal réessaie).
❓ `/auth/moi/` n'est pas suivi d'une tentative de rafraîchissement sur 401 (`lib/api.js` exclut `/api/auth/*`) :
voir R26 dans [risques-et-dette](../project/risques-et-dette.md).

## Tests
`backend/apps/noyau/tests/test_permissions.py`, `test_securite.py`, `test_audit_securite.py` (poste connu
infalsifiable, CSRF du rafraîchissement, borne conservée au rafraîchissement, regroupement IPv6 /64,
`test_poste_connu_reste_limite`, `test_rafraichissements_simultanes_sans_deconnexion`), `test_durcissement.py`
(`test_desactivation_ferme_les_sessions`), `test_temps_reel.py` (`test_deconnexion_ferme_le_temps_reel_de_la_session`),
`frontend/tests/garde.test.jsx`, `connexion.test.js`.
Décisions : [ADR-002](../decisions/ADR-002-jwt-cookies-httponly.md), [ADR-003](../decisions/ADR-003-comptes-mot-de-passe-temporaire.md).
