---
type: operations
statut: implémenté
verifie: 2026-10-14
commit: 36389e6
sources: [docker-compose.prod.yml, infra/Caddyfile.prod, backend/Dockerfile, backend/Dockerfile.vercel, backend/gunicorn.conf.py, frontend/vercel.json, .vercelignore, infra/charge/README.md, README.md]
---

# Déploiement

⚠️ Aucun déploiement (production ou Vercel) sans autorisation explicite.

## Production — `docker-compose.prod.yml`
```bash
cd frontend && npm ci && npm run build && cd ..
docker compose -f docker-compose.prod.yml up -d --build
# premier super admin :
docker compose -f docker-compose.prod.yml exec django python manage.py shell -c \
  "from apps.comptes.models import Admin; Admin.objects.create_superuser('email', 'Nom', 'mot-de-passe')"
```
| Service | Rôle |
|---|---|
| mysql | `max-connections=600`, buffer InnoDB `MYSQL_INNODB_BUFFER` (1G), non exposé |
| redis | `volatile-lru` (n’évince jamais la file d’emails), AOF, non exposé |
| migrate | migrations au démarrage (le service django attend sa réussite) |
| django | Gunicorn + workers Uvicorn (`WEB_CONCURRENCY`, défaut 4), `DB_CONCURRENCE` 24, utilisateur sans privilèges `flex`, HEALTHCHECK `/api/sante/` ; `--scale django=3` possible |
| celery | `CELERY_CONCURRENCY` (4), `--max-tasks-per-child 500`, contrôle de santé |
| celery-beat | relance des emails (5 min), purge (1 h), sondages de satisfaction (8 h puis chaque heure jusqu'à 20 h) |
| proxy | Caddy : HTTPS automatique sur `DOMAINE` (défaut `emargement.mde.ci` ❓ à confirmer), sert `frontend/dist`, relaie `/api` |

`.env` de production : `DJANGO_DEBUG=0`, `DJANGO_SECRET_KEY` ≥ 32 caractères, `DOMAINE`, `APP_PUBLIC_URL` en HTTPS,
`DJANGO_ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, mots de passe MySQL forts, SMTP. **Ne jamais lancer `seed_demo`.**

## Test en ligne — Vercel ([ADR-007](../decisions/ADR-007-environnement-test-vercel.md))
- Frontend https://flex-checking.vercel.app (projet `flex-checking`) ; `.vercelignore` n’envoie que `frontend/`.
- Backend https://flex-checking-api.vercel.app (projet `flex-checking-api`, `backend/Dockerfile.vercel`, `fra1`), base Neon.
- Préparation de la base depuis un poste : `vercel env pull` (fichier privé), puis `migrate`, `createcachetable`, `seed_demo`.
- En-têtes de sécurité et cache des assets définis dans `frontend/vercel.json`.
- Cron du sondage : `backend/vercel.json` (`0 8 * * *` → `/api/taches-planifiees/sondages/`) ; **exige la variable
  `CRON_SECRET`** sur `flex-checking-api` (Vercel l'envoie en `Authorization: Bearer`). Voir [sondage-satisfaction](../features/sondage-satisfaction.md).

## Tests de charge
Procédure et résultats de référence : `infra/charge/README.md` (à lancer sur un environnement de test,
jamais en production ; nettoyer les invités `charge.*@test.ci` ensuite). Synthèse dans
[non-functional-requirements](../specifications/non-functional-requirements.md).
