---
type: feature
statut: implémenté
verifie: 2026-10-26
commit: 2523cbb
sources: [backend/apps/comptes/views.py, backend/apps/noyau/temps_reel.py, backend/apps/noyau/consumers.py, backend/config/asgi.py, backend/apps/comptes/authentication.py, frontend/src/lib/tempsReel.js, frontend/src/features/admin/SuiviEmails.jsx, frontend/src/features/admin/CarteSatisfaction.jsx, backend/apps/noyau/tests/test_temps_reel.py, frontend/tests/tempsReel.test.js]
---

# Temps réel (WebSocket)

## Principe ([ADR-006](../decisions/ADR-006-temps-reel-sujets-sans-donnees.md))
Le serveur n’envoie que des **sujets** qui ont changé (`invites`, `statistiques`, `recents`, `evenements`,
`evenement`, `journal`, `admins`, `programmes`, `parametres`, `apercu-emails`, `sondage`, `moi`, `erreurs`) et des
identifiants d’événements, jamais de données personnelles. Le navigateur invalide les requêtes React Query
correspondantes (`REQUETES_PAR_SUJET`) et recharge par l’API REST, qui applique les droits.
Depuis `bd4f807` : `statistiques` recharge aussi `suivi-emails` (écran « Suivi des emails ») ; le nouveau sujet
`sondage` recharge `sondage` (carte satisfaction), `sondages-global` (analyses super admin) et `suivi-emails` ;
`apercu-emails` sert toujours (aperçus affichés dans `SuiviEmails.jsx`).

## Serveur
- Signaux Django (`temps_reel.py`) sur Invite, Emargement, EmailEnvoye, InvitationSondage (création/mise à jour ;
  sa suppression est couverte par celle de l’invité), ReponseSondage, JournalActivite, Evenement, Programme,
  Parametres, Admin, affectations (M2M), ErreurTechnique → `notifier()` regroupe par (groupe, type) et envoie
  **au commit**. Les mêmes signaux invalident les caches (stats, page publique, analyses).
- Groupes : `evenement.<id>`, `tous` (super admins), `compte.<id>`, `connectes`.
- `TempsReelConsumer` (`/api/ws/`) : authentification par le cookie `fc_access`, origine vérifiée, compte actif
  et sorti du mot de passe temporaire ; un admin ne rejoint que ses événements ; fermeture à l’expiration du
  jeton (code **4001**), compte désactivé/supprimé (**4003**) ; message `perimetre` → groupes recalculés.
  Messages du navigateur ignorés. Accès base bornés par un sémaphore (`DB_CONCURRENCE`).
- Sans Redis (`CHANNEL_LAYERS = {}`) : connexion acceptée puis fermée avec le code **4004** (temps réel indisponible).
- Jeton d'accès révoqué par une déconnexion (`authentication.acces_revoque`) ou antérieur à un changement de mot de
  passe ou à une désactivation du compte (`jeton_revoque`, `version_session`) : fermeture 4001.
- **Déconnexion immédiate** : `DeconnexionView` envoie au groupe `compte.<id>` le message `session_fermee` avec le
  jti du jeton d'accès ; `TempsReelConsumer.session_fermee` ferme en 4001 la seule connexion ouverte avec ce jeton
  (auparavant, elle restait ouverte jusqu'à l'expiration du jeton). Depuis `7e0e071`, les autres sessions du compte
  ne sont plus sollicitées (le 2026-10-22, un message `perimetre` leur faisait recalculer leurs groupes).
  `perimetre` reste envoyé à chaque enregistrement du compte (rôle, mot de passe, activation : un compte désactivé
  ou repassé en mot de passe temporaire est fermé en 4003) et aux changements d'affectation ; `fermer` (4003) à la
  suppression du compte.

## Navigateur (`lib/tempsReel.js`)
- Une connexion par onglet, ouverte par `RequireRole` dans les espaces connectés.
- Regroupement des sujets sur 250 ms ; après une reconnexion, tout est rechargé.
- Reconnexion exponentielle avec gigue (≤ 30 s), relance sur `online` et retour de visibilité.
- 4001 → rafraîchir la session puis reconnecter ; 4003 → fin de session.
- États (`useEtatTempsReel`) : `connexion`, `connecte`, `deconnecte`, **`indisponible`** (fermeture 4004 envoyée par
  le serveur : pas de Redis, ex. Vercel ; une coupure réseau reste « Reconnexion… ») ; en `indisponible`, nouvel essai
  silencieux toutes les 5 min et l’en-tête admin affiche « Actualisation auto ».
- `useSecours(ms)` : interrogation périodique (5 s tableau de bord / invités / fiche invité / scan, 15 s suivi des
  emails, journal et données du super admin (`super/donnees.js`), 30–60 s ailleurs)
  **seulement** quand le temps réel est déconnecté.

## Mesures
500 écrans notifiés en 0,09 s ([infra/charge/README.md](../operations/deployment.md#tests-de-charge)).

## Tests
`test_temps_reel.py` (4001, 4003, 4004 sans relais, origine, périmètre admin/super admin, désactivation, affectation,
`test_deconnexion_ferme_le_temps_reel_de_la_session`),
`test_securite.py` (WebSocket et révocation), `frontend/tests/tempsReel.test.js` (regroupement, reconnexion, état « indisponible » sur 4004 sans relance par
`online` / visibilité), `analyses.test.jsx`,
e2e « une inscription apparaît chez l’admin sans rechargement ».
