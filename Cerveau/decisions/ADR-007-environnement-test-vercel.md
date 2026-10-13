---
type: decision
statut: acceptée
verifie: 2026-10-13
commit: dc0c75a
sources: [README.md, backend/Dockerfile.vercel, backend/config/settings.py, backend/config/bases.py, frontend/vercel.json, backend/vercel.json, .vercelignore]
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

## Conséquences
- ➕ démonstration en ligne sans infrastructure.
- ➖ pas de temps réel (interrogation 5 s), pas de relance d’email ; emails écrits dans les journaux (pas d’envoi réel).
- ➖ deux moteurs de base à supporter (MySQL et Postgres) : le verrou de `emarger` a été écrit pour les deux.
