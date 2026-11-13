---
type: feature
statut: implémenté
verifie: 2026-11-13
commit: 0a11d09
sources: [backend/apps/noyau/vues_admin.py, backend/apps/noyau/consumers.py, backend/apps/noyau/tests/test_durcissement.py, backend/apps/noyau/tests/test_temps_reel.py, backend/apps/comptes/views.py, backend/apps/comptes/authentication.py, backend/apps/comptes/permissions.py, backend/apps/comptes/throttles.py, backend/config/settings.py, frontend/src/lib/api.js, frontend/src/features/auth/useMoi.js, frontend/src/features/auth/RequireRole.jsx, backend/apps/noyau/tests/test_audit_securite.py, frontend/src/App.jsx, frontend/src/lib/nouvelleVersion.js, frontend/src/main.jsx, infra/Caddyfile.prod]
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
  depuis un autre site. API en **JSON uniquement** (plus de `MultiPartParser`) : un formulaire posté d'ailleurs → 415 ; seule exception, `POST public/sondages/<jeton>/reponse/` (formulaire de l'email n°3, sans authentification).
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
  IPv4 mappée `::ffff:…` redevient l'IPv4) ; sinon un client changerait d'adresse à chaque essai. Depuis le
  2026-11-09, les images des emails (`GET /api/public/emails/images/…`) ont leur propre limite `images_email`
  (`LIMITE_IMAGES_EMAIL`, 3000/min par défaut) pour ne pas épuiser la limite anonyme partagée avec l'inscription.
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
  **Jeton copié** (2026-11-13) : hors de cette fenêtre, un jeton authentique, de la session en cours, mais déjà
  révoqué ferme **toutes** les sessions du compte (`_compte_du_jeton_reutilise`, `_fermer_sessions_jeton_reutilise` :
  `nouvelle_version_session`, action `SESSION_REUTILISEE`, alerte par email) — voir R35.
- **CSRF** : jeton renouvelé à la connexion (`rotate_token`, 2026-11-13).
- Champ mot de passe avec bouton « Afficher / Masquer » (`Champ`, aussi dans le changement de mot de passe).
- Deux écrans : `/connexion` (admin, redirection selon le rôle) et `/super/connexion` (univers MDE).
- Retour après connexion vers `state.depuis`, filtré par `cheminInterne` (pas de redirection ouverte).
- `oublierMoi` (`useMoi.js`, appelé sur 401 et à la déconnexion) efface aussi l'historique du poste de scan en
  `sessionStorage` (`fc-scan-historique-*`, `fc-scan-dernier-*`) : aucun nom d'invité ne reste sur une tablette partagée.

## Signature des jetons (2026-11-09) ✅
- Méthode imposée par le serveur (`SIMPLE_JWT` dans `backend/config/settings.py`) : **HS256 uniquement** à la
  vérification ; l'`alg` annoncé par l'en-tête n'est pas suivi (`none`, HS384/HS512 même signés avec la bonne clé,
  RS256 avec une clé publique jointe en `jwk` → 401). Aucune clé lue depuis le jeton (`JWK_URL` nul, `jku` ignoré).
- Clé propre aux JWT : `JWT_SIGNING_KEY` (≥ 32 caractères) ou, par défaut, HMAC-SHA256 de `DJANGO_SECRET_KEY` (sel
  `flex-checking/jwt-signature`) : le secret Django signe d'autres choses (choix de la borne, sondage) mais ne
  permet pas de forger une session. Changer la clé ferme toutes les sessions.
- Émetteur `iss = flex-checking` et destinataire `aud = flex-checking-api` exigés ; `LEEWAY` 0.
- Contenu (payload) **signé, non chiffré** : `token_type`, `exp`, `iat`, `jti`, `user_id`, `vs`, `borne`, `iss`,
  `aud` — aucune donnée personnelle ; toute modification (compte, expiration, version de session) casse la signature.
  Chiffrement (JWE) non retenu : non pris en charge par SimpleJWT, nouvelle dépendance, et rien de sensible à cacher
  dans un cookie httpOnly.
- **Jetons de rafraîchissement jamais stockés en clair** (2026-11-09) : SimpleJWT écrivait chaque jeton en entier
  dans `token_blacklist_outstandingtoken.token` ; lu dans la base, il ouvrait une session de 12 h (constaté : 204 au
  rafraîchissement pour un compte à `version_session` 0). Signal `pre_save` (`comptes.jetons.vider_texte_du_jeton`,
  branché dans `ComptesConfig.ready`) : texte vidé, seuls `jti`, compte et dates restent (suffisants pour la liste
  noire et la détection des rotations). `comptes.jetons.purger_jetons` vide les anciens textes et supprime les jetons
  expirés : tâche horaire `tasks.purger` (VPS) et cron Vercel (`CronSondagesView`, clé `jetons`).
- JWT masqués (`[jwt]`) dans les journaux et les erreurs techniques (`logs.masquer_jetons`, `erreurs.masquer`).
- Marqueur `borne` retiré ou mis à faux : signature cassée, 401.
- Preuves : `backend/apps/noyau/tests/test_jwt.py` (13 tests : API, rafraîchissement, `AccessToken` du temps réel,
  stockage, purge, cron, masquage, borne).
- Effet du déploiement : les jetons émis avant (sans `iss`/`aud`, autre clé) sont refusés → **une reconnexion
  unique** de chaque compte, bornes comprises.

## Échecs de connexion, alertes, mots de passe fuités (2026-11-09) ✅
- Échec sur un compte existant : journal d'activité `CONNEXION_ECHEC` (raison `mot_de_passe` ou `compte_inactif`,
  réseau IPv4 ou /64, auteur affiché « Tentative de connexion ») ; premier refus d'une série bloquée :
  `CONNEXION_BLOQUEE` + **alerte email** aux super admins actifs (une par compte et par heure). Compte inconnu :
  logger `securite` seulement (aucune ligne en base). Jamais d'email dans ces traces (`comptes.views._connexion_refusee`).
- Alertes (`noyau.alertes`) : aussi à chaque **nouvelle** erreur serveur, tâche ou email (pas pour les signalements du
  navigateur) ; 10 par heure au plus ; envoi Celery ; un échec d'envoi n'enregistre aucune erreur (pas de boucle).
- Mot de passe choisi (`auth/mot-de-passe/`) : refusé s'il figure dans des fuites connues
  (`comptes.validateurs.MotDePasseNonCompromis`, API Pwned Passwords par k-anonymat : 5 caractères de l'empreinte
  SHA-1 envoyés, remplissage demandé, délai 3 s ; service injoignable → accepté et journalisé).
  `VERIFIER_MOTS_DE_PASSE_FUITES` (vrai par défaut, faux dans les tests). Le mot de passe temporaire généré par le
  super admin n'est pas concerné (aléatoire).
- Preuves : `backend/apps/noyau/tests/test_securite_comptes.py` (10 tests) ; appel réel vérifié le 2026-11-09
  (`password123` : 2 266 543 fuites ; mot de passe aléatoire : 0).

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
Depuis le 2026-11-02, un 401 de `/auth/moi/` (comme de toute route hors connexion, rafraîchissement, CSRF et
déconnexion : `SANS_RAFRAICHISSEMENT` de `lib/api.js`) déclenche une tentative de `/auth/rafraichir/` : rouvrir
l'application après l'expiration du cookie d'accès (15 min) renouvelle la session tant que `fc_refresh` est valide
(R26 résolu, `frontend/tests/api.test.js`).

**Onglet ouvert pendant une mise à jour du site** (2026-11-10, `1c0c98e` puis `a55a65c`) : toutes les pages
chargées à la demande d'`App.jsx` (espaces admin, scan, super admin, pages invité, connexions) passent par
`pageDifferee` (`frontend/src/lib/nouvelleVersion.js`) au lieu de `React.lazy` direct. Quand un ancien fichier
`/assets/…` n'existe plus, Vite émet `vite:preloadError` ; `installerRechargementVersion` (appelé dans `main.jsx`)
recharge la page une fois (horodatage dans `sessionStorage`, pas de second rechargement en moins d'une minute, rien
si le stockage est indisponible) et `pageDifferee` reste sur l'écran de chargement au lieu de lever l'erreur
« a._result.default » (constatée sur iPhone). Côté VPS, `infra/Caddyfile.prod` répond 404 pour un fichier
`/assets/*` absent au lieu de la page d'entrée. Test `frontend/tests/nouvelleVersion.test.jsx`.

## Tests
`backend/apps/noyau/tests/test_permissions.py`, `test_securite.py`, `test_audit_securite.py` (poste connu
infalsifiable, CSRF du rafraîchissement, borne conservée au rafraîchissement, regroupement IPv6 /64,
`test_poste_connu_reste_limite`, `test_rafraichissements_simultanes_sans_deconnexion`), `test_durcissement.py`
(`test_desactivation_ferme_les_sessions`), `test_temps_reel.py` (`test_deconnexion_ferme_le_temps_reel_de_la_session`),
`frontend/tests/garde.test.jsx`, `connexion.test.js`, `nouvelleVersion.test.jsx`.
Décisions : [ADR-002](../decisions/ADR-002-jwt-cookies-httponly.md), [ADR-003](../decisions/ADR-003-comptes-mot-de-passe-temporaire.md).
