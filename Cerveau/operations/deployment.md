---
type: operations
statut: implémenté
verifie: 2026-10-27
commit: bed9942
sources: [backend/config/bases.py, backend/requirements.txt, docker-compose.yml, frontend/package.json, frontend/.npmrc, backend/apps/noyau/management/commands/seed_demo.py, backend/apps/noyau/emails.py, docker-compose.prod.yml, infra/Caddyfile.prod, backend/Dockerfile, backend/Dockerfile.vercel, backend/gunicorn.conf.py, frontend/vercel.json, backend/vercel.json, .vercelignore, infra/charge/README.md, README.md, backend/config/settings.py, backend/apps/noyau/vues_sondage.py]
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
| mysql | `max-connections=600`, buffer InnoDB `MYSQL_INNODB_BUFFER` (1G), durabilité par défaut (`innodb-flush-log-at-trx-commit=2` retiré le 2026-10-22), journaux binaires 7 jours (`--binlog-expire-logs-seconds=604800`), non exposé |
| redis | `volatile-lru` (n’évince jamais la file d’emails), AOF, non exposé |
| migrate | migrations au démarrage (le service django attend sa réussite) |
| django, celery, celery-beat (ancre `x-backend`) | volume partagé `media-data:/app/media` (exports lourds écrits par Celery, téléchargés par Django ; R17 résolu le 2026-10-22) |
| django | Gunicorn + workers Uvicorn (`WEB_CONCURRENCY`, défaut 4), `DB_CONCURRENCE` 24, utilisateur sans privilèges `flex`, HEALTHCHECK `/api/sante/` ; `--scale django=3` possible |
| celery | `CELERY_CONCURRENCY` (4), `--max-tasks-per-child 500`, contrôle de santé |
| celery-beat | relance des emails (5 min), purge (1 h), sondages de satisfaction (8 h puis chaque heure jusqu'à 20 h), anonymisation des données personnelles expirées (3 h 30, `anonymiser-donnees`) |
| proxy | Caddy : HTTPS automatique sur `DOMAINE` (défaut `emargement.mde.ci` ❓ à confirmer), sert `frontend/dist`, relaie `/api` ; en-têtes HSTS, CSP (`frame-src 'self' blob:`, sans `data:`), `Referrer-Policy same-origin` ; journaux d'accès sans `?q=` ni jeton `/sondage(s)/<jeton>` (masqués) ni Referer |

Image backend (`backend/Dockerfile`, depuis le 2026-10-22) : étape `construction` (compilateurs, `mysqlclient`) →
`base` (Python 3.12 + `libmariadb3`, environnement `/opt/venv` copié) → cible `prod` (`flex-checking-backend:prod`,
558 Mo mesurés, sans compilateur). Tous les services ont des journaux plafonnés (`x-journaux` : 3 × 10 Mo). Images
de base non épinglées par empreinte (R22 de [risques-et-dette](../project/risques-et-dette.md)) : reconstruire avec
`docker compose build --pull` pour récupérer leurs correctifs.

`.env` de production : `DJANGO_DEBUG=0`, `DJANGO_SECRET_KEY` ≥ 32 caractères, `DOMAINE`, `APP_PUBLIC_URL` en HTTPS,
`DJANGO_ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, mots de passe MySQL forts, SMTP, `DEFAULT_FROM_EMAIL` en adresse
seule (le code construit `« {expediteur} <DEFAULT_FROM_EMAIL> »`). **Ne jamais lancer `seed_demo`** (refusé hors
`DEBUG` sans `--force`). Seuls les ports 80/443 de Caddy sont publiés. Guide pas à pas :
[deploiement-infomaniak](deploiement-infomaniak.md).

## Test en ligne — Vercel ([ADR-007](../decisions/ADR-007-environnement-test-vercel.md))
- Frontend https://flex-checking.vercel.app (projet `flex-checking`) ; `.vercelignore` n’envoie que `frontend/`.
- Backend https://flex-checking-api.vercel.app (projet `flex-checking-api`, `backend/Dockerfile.vercel`, `fra1`), base Neon.
- Temps de réponse mesurés le 2026-10-26 (`curl`, avant le pool) : route sans base ≈ 0,16 s sur une connexion
  réutilisée, `/api/sante/` (un `SELECT 1`) 0,6 à 1,1 s, premier appel après inactivité 5,2 s (démarrage de la
  fonction). L'écart venait de l'ouverture d'une connexion chiffrée vers Neon à chaque requête : pool de
  connexions Postgres depuis le 2026-10-26 (voir [ADR-009](../decisions/ADR-009-file-attente-concurrence.md)).
  ✅ Mesuré en ligne après déploiement de `43f99c5` (30 appels chacun) : `/api/sante/` médiane 0,17 s (p90 0,21 s)
  au lieu de 0,6 à 1,1 s ; `/api/auth/csrf/` 0,16 s. ❓ Une 404 de `public/evenements/<slug>/` (lien inconnu)
  reste à 1,04 s en ligne alors qu'elle prend 4 ms en local (2 requêtes SQL) : cause non identifiée, sans effet
  sur un lien valide (mis en cache).
- Préparation de la base depuis un poste : `vercel env pull` (fichier privé), puis `migrate`, `createcachetable`, `seed_demo`
  (procédure du README ; depuis le 2026-10-22, `seed_demo --force` si `DEBUG` est faux). ❓ À confirmer : d'après `log.md` (2026-10-14), les variables de type « Secret » ne sont pas
  restituées par `vercel env pull` ; les migrations 0008 à 0011 ont été appliquées avec l'URL non poolée de Neon
  (0010 et 0011 le 2026-10-22, avant le déploiement du code).
- En-têtes de sécurité et cache des assets définis dans `frontend/vercel.json` (CSP avec `frame-src 'self' blob:`,
  `Referrer-Policy: same-origin`, identiques à `infra/Caddyfile.prod`).
- Crons du sondage : `backend/vercel.json`, deux entrées vers la même vue avec des chemins distincts
  (`/api/taches-planifiees/sondages/?passage=8h` à `0 8 * * *` et `?passage=12h` à `0 12 * * *`, heures UTC) ; le
  paramètre `passage` n'est pas lu par `vues_sondage.CronSondagesView`, il sert seulement à éviter que Vercel fusionne
  les deux crons. **Exige la variable `CRON_SECRET`** (≥ 32 caractères, `LONGUEUR_MIN_SECRET`) sur `flex-checking-api` :
  Vercel l'envoie en `Authorization: Bearer` ; sans secret valide la route répond 404. Voir
  [sondage-satisfaction](../features/sondage-satisfaction.md). Le même appel lance aussi l'anonymisation des
  données expirées (`donnees_personnelles.anonymiser_donnees_expirees`, voir
  [donnees-personnelles](../features/donnees-personnelles.md)).
- Build du frontend : Node.js ≥ 24.22.1 exigé par `frontend/package.json` (`engines`, `engine-strict` dans
  `frontend/.npmrc`) ; ✅ vérifié le 2026-10-26 : le déploiement de production déclenché par le push de `d220011`
  est « Ready » (le garde-fou `engines` est passé), site et `/confidentialite` en 200. Si Vercel construisait un jour
  avec une 24.x plus ancienne, le build échouerait et la version en ligne resterait la précédente.

## Tests de charge
Procédure et résultats de référence : `infra/charge/README.md` (à lancer sur un environnement de test,
jamais en production ; nettoyer les invités `charge.*@test.ci` ensuite). Synthèse dans
[non-functional-requirements](../specifications/non-functional-requirements.md).
