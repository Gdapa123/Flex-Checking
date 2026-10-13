---
type: feature
statut: implémenté
verifie: 2026-10-13
commit: dc0c75a
sources: [backend/apps/noyau/temps_reel.py, backend/apps/noyau/consumers.py, backend/config/asgi.py, frontend/src/lib/tempsReel.js]
---

# Temps réel (WebSocket)

## Principe ([ADR-006](../decisions/ADR-006-temps-reel-sujets-sans-donnees.md))
Le serveur n’envoie que des **sujets** qui ont changé (`invites`, `statistiques`, `recents`, `evenements`,
`evenement`, `journal`, `admins`, `programmes`, `parametres`, `apercu-emails`, `moi`, `erreurs`) et des
identifiants d’événements, jamais de données personnelles. Le navigateur invalide les requêtes React Query
correspondantes (`REQUETES_PAR_SUJET`) et recharge par l’API REST, qui applique les droits.

## Serveur
- Signaux Django (`temps_reel.py`) sur Invite, Emargement, EmailEnvoye, JournalActivite, Evenement, Programme,
  Parametres, Admin, affectations (M2M), ErreurTechnique → `notifier()` regroupe par (groupe, type) et envoie
  **au commit**. Les mêmes signaux invalident les caches (stats, page publique, analyses).
- Groupes : `evenement.<id>`, `tous` (super admins), `compte.<id>`, `connectes`.
- `TempsReelConsumer` (`/api/ws/`) : authentification par le cookie `fc_access`, origine vérifiée, compte actif
  et sorti du mot de passe temporaire ; un admin ne rejoint que ses événements ; fermeture à l’expiration du
  jeton (code **4001**), compte désactivé/supprimé (**4003**) ; message `perimetre` → groupes recalculés.
  Messages du navigateur ignorés. Accès base bornés par un sémaphore (`DB_CONCURRENCE`).
- Sans Redis (`CHANNEL_LAYERS = {}`) : connexion acceptée puis fermée avec le code **4004** (temps réel indisponible).
- Jeton d'accès révoqué par une déconnexion : fermeture 4001.

## Navigateur (`lib/tempsReel.js`)
- Une connexion par onglet, ouverte par `RequireRole` dans les espaces connectés.
- Regroupement des sujets sur 250 ms ; après une reconnexion, tout est rechargé.
- Reconnexion exponentielle avec gigue (≤ 30 s), relance sur `online` et retour de visibilité.
- 4001 → rafraîchir la session puis reconnecter ; 4003 → fin de session.
- États (`useEtatTempsReel`) : `connexion`, `connecte`, `deconnecte`, **`indisponible`** (fermeture 4004 envoyée par
  le serveur : pas de Redis, ex. Vercel ; une coupure réseau reste « Reconnexion… ») ; en `indisponible`, nouvel essai
  silencieux toutes les 5 min et l’en-tête admin affiche « Actualisation auto ».
- `useSecours(ms)` : interrogation périodique (5 s tableau de bord / invités / scan, 15–30 s ailleurs)
  **seulement** quand le temps réel est déconnecté.

## Mesures
500 écrans notifiés en 0,09 s ([infra/charge/README.md](../operations/deployment.md#tests-de-charge)).

## Tests
`test_temps_reel.py` (4001, 4003, origine, périmètre admin/super admin, désactivation, affectation),
`test_securite.py` (WebSocket et révocation), `frontend/tests/tempsReel.test.js`, `analyses.test.jsx`,
e2e « une inscription apparaît chez l’admin sans rechargement ».
