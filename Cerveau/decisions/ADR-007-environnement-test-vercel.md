---
type: decision
statut: acceptée
verifie: 2026-10-27
commit: bed9942
sources: [README.md, backend/Dockerfile.vercel, backend/config/settings.py, backend/config/bases.py, frontend/vercel.json, backend/vercel.json, .vercelignore, backend/apps/noyau/vues_sondage.py, backend/apps/noyau/urls.py, backend/apps/noyau/donnees_personnelles.py]
---

# ADR-007 — Environnement de test en ligne sur Vercel, sans Redis

- **Date** : 2026-10-12 (commits `59ca1b7` à `e8275b1`)
- **Statut** : acceptée — environnement de **test** uniquement ; la production reste `docker-compose.prod.yml`

## Contexte
Besoin d’une URL de test accessible sans serveur dédié.

## Décision
- Frontend : projet Vercel `flex-checking` (dossier `frontend`, `frontend/vercel.json` relaie `/api/*` vers le backend).
- Backend : projet `flex-checking-api`, image `backend/Dockerfile.vercel`, région `fra1`, base **Postgres Neon**
  (`DATABASE_URL`, chiffrement imposé par défaut, options de l’URL conservées).
- Sans Redis (`REDIS_URL` vide) : cache local, limites anti-abus partagées en base (`createcachetable`), pas de
  relais temps réel, Celery en mode eager, emails en une tentative, exports toujours dans la requête.
- Sans Celery Beat (complément du 2026-10-14, commits `bd4f807` et `be899ff`) : l’envoi planifié du sondage de
  satisfaction est déclenché par les **crons Vercel** de `backend/vercel.json` (8 h et 12 h UTC, chemins distincts
  `?passage=8h` / `?passage=12h` pour que Vercel ne les fusionne pas) vers `GET /api/taches-planifiees/sondages/`
  (`vues_sondage.CronSondagesView`), protégé par la variable `CRON_SECRET` (≥ 32 caractères, sinon route en 404).
  Voir [ADR-012](ADR-012-sondage-satisfaction.md). Depuis le 2026-10-22 (`d91d426`), le même cron lance aussi
  l'anonymisation des données personnelles expirées (`donnees_personnelles.anonymiser_donnees_expirees`, clé
  `anonymisation` de la réponse), assurée ailleurs par la tâche Beat nocturne `anonymiser_donnees` (3 h 30) —
  voir [ADR-013](ADR-013-conservation-limitee-anonymisation.md).

## Conséquences
- ➕ démonstration en ligne sans infrastructure.
- ➖ pas de temps réel (interrogation 5 s), pas de relance d’email ; emails écrits dans les journaux (pas d’envoi réel).
- ➖ deux moteurs de base à supporter (MySQL et Postgres) : le verrou de `emarger` a été écrit pour les deux. La CI
  ne teste que MySQL : le verrou du rafraîchissement de session échouait sur Postgres (500 à chaque rafraîchissement
  sur Vercel), corrigé dans `43f99c5` après une passe pytest manuelle sur Postgres (R25). Connexions Postgres
  réutilisées par un pool depuis `43f99c5` ([ADR-009](ADR-009-file-attente-concurrence.md)).
- ➖ sondage : deux passages par jour seulement (au lieu de chaque heure de 8 h à 20 h avec Beat) ; un secret de
  plus à gérer sur le projet `flex-checking-api`.
