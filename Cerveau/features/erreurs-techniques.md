---
type: feature
statut: implémenté
verifie: 2026-11-13
commit: b0db942
sources: [frontend/src/lib/serviceWorker.js, backend/apps/noyau/erreurs.py, backend/apps/noyau/logs.py, backend/apps/comptes/throttles.py, backend/apps/noyau/vues_erreurs.py, backend/apps/noyau/exceptions.py, frontend/src/lib/signalement.js, frontend/src/components/ui/FiletErreur.jsx, frontend/src/features/super/Erreurs.jsx]
---

# Erreurs techniques

**Règle d’interface** : l’utilisateur ne voit jamais de détail technique (message neutre + « Recharger » ou
« Réessayer ») ; le détail est consultable par le seul super admin dans **Super admin › Erreurs**.

## Sources capturées
| Source | Capture |
|---|---|
| NAVIGATEUR | `FiletErreur` (écran planté), `window.onerror`, `unhandledrejection` → `POST /api/erreurs/` (public, 30/min par IP — `SignalementThrottle`, dérivée de `LimiteIpPartagee` depuis 2026-10-14 : compteur partagé entre instances dans le cache des limites, IPv6 regroupée par /64 — sans cookie, `keepalive`) ; 20 max par page, dédoublonnées ; erreurs d’API ignorées ; **seules les erreurs dont le fichier ou la trace passe par l’origine de l’application sont signalées** (`signalement.vientDeLApplication`) : celles des extensions et des scripts injectés par les navigateurs intégrés (Instagram, Facebook…) sont ignorées ; ignorés aussi : « Script error. » sans objet Error ni fichier (script d’une autre origine masqué par le navigateur) et tout signalement d’un robot d’exploration (`signalement.estRobot` : GoogleOther, Googlebot…) |
| SERVEUR | `gestionnaire_exceptions` (500 neutre `ERREUR_SERVEUR`) et signal `got_request_exception` |
| TACHE | signal Celery `task_failure`, file d’emails injoignable, relais temps réel |
| EMAIL | échec définitif d’un envoi |

## Enregistrement (`erreurs.enregistrer`)
- Regroupement par **signature** (source, type, message et lieu, chiffres remplacés par `#`) avec compteur
  d’occurrences ; une erreur résolue qui revient est **rouverte**.
- Emails et téléphones masqués, URL sans paramètres ni ancre, tailles bornées.
- **Jeton du sondage masqué** (2026-10-14) : côté serveur, `logs.masquer_jetons` remplace le segment après
  `/sondage/` ou `/sondages/` par `[jeton]` dans le lieu ; côté navigateur, `signalement.normaliserLieu` envoie
  `/sondage/:jeton` au lieu du chemin réel (lien personnel à usage unique, voir [sondage-satisfaction](sondage-satisfaction.md)).
- Quotas : 2 000 signatures navigateur, 5 000 autres ; conservation 30 jours (purge Celery beat horaire).
- Ne lève jamais d’exception (ne doit pas aggraver la panne).

## Alertes (2026-11-09)
Une nouvelle signature d'erreur côté serveur, tâche ou email déclenche un email aux super admins actifs
(`noyau.alertes.alerter`, une fois par signature et par heure, 10 alertes par heure au plus) ; jamais pour les
signalements du navigateur (point d'accès public). Message masqué (emails, téléphones, liens de sondage, JWT).

## Écran super admin
Filtres à traiter / résolues / toutes et par source, détail dépliable (trace, navigateur), « Résolue / Rouvrir »,
« Tout marquer résolu », « Supprimer les résolues ». Mise à jour en temps réel.

## Tests
`test_erreurs.py`, `frontend/tests/signalement.test.js`, `frontend/tests/serviceWorker.test.js`, `frontend/tests/sondage.test.jsx` (`normaliserLieu`).

## Historique notable
- 2026-10-13 : erreur « Error · Rejected » sur `/i/pmd-2026-387a21/` (navigateur, 12/10/2026 17:04). La chaîne
  « Rejected » n’existe ni dans le code, ni dans le build, ni dans les dépendances : erreur d’un script tiers injecté
  dans la page. Correctif : filtre `vientDeLApplication` dans `frontend/src/lib/signalement.js` (test dans
  `frontend/tests/signalement.test.js`). L’entrée existante est à marquer « Résolue » dans Super admin › Erreurs.
- 2026-11-13 : quatre erreurs du 10 au 12/11 sur inscription.mde.ci, corrigées (en attente de déploiement) :
  - « SecurityError · Script …/sw.js load failed » (iPhone) : le `registerSW.js` généré par vite-plugin-pwa
    n’interceptait pas le refus de Safari (navigation privée, mode Isolement). L’enregistrement est désormais fait par
    `frontend/src/lib/serviceWorker.js` (`enregistrerServiceWorker`, échec ignoré, `injectRegister: false` dans
    `frontend/vite.config.js`).
  - « Script error. » (navigateur PHX sur Android) : script étranger, filtré dans `installerSignalement`.
  - « Failed to fetch dynamically imported module » (robot GoogleOther, ancienne version) : robots ignorés.
  - Erreur React sans message sur iPhone (trace ramenée aux sources avec les sourcemaps de `e75bba3` :
    `React.lazy` relance l’échec de téléchargement d’une page, après le rechargement automatique de
    `nouvelleVersion.js`) : connexion coupée. `FiletErreur` affiche alors « La page n’a pas pu se charger. Vérifiez
    votre connexion internet… » (`signalement.estEchecChargement`) au lieu de « problème d’affichage » ; l’erreur
    reste signalée.
