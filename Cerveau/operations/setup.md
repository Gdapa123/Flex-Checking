---
type: operations
statut: implémenté
verifie: 2026-10-27
commit: bed9942
sources: [backend/config/bases.py, .gitignore, README.md, docker-compose.yml, backend/Dockerfile, frontend/package.json, frontend/.npmrc, frontend/.nvmrc, .env.example, infra/certs.sh, infra/Caddyfile, backend/apps/noyau/management/commands/seed_demo.py, backend/config/settings.py]
---

# Installation et développement local

La procédure détaillée et à jour est dans `README.md` §1, §2, §6. Résumé :

## Avec Docker Compose (HTTPS local)
```bash
cp .env.example .env          # adapter les valeurs ; ne jamais commiter .env
./infra/certs.sh              # certificats mkcert (+ IP du poste pour les téléphones : ./infra/certs.sh 192.168.x.x)
docker compose up -d --build  # mysql, redis, mailpit, django, celery, celery-beat, frontend, proxy
docker compose exec django python manage.py seed_demo
```
→ https://flex-checking.localhost (port 8443 pour l’IP du réseau local) ; emails dans Mailpit http://localhost:8025.

| Service | Port hôte |
|---|---|
| mysql | 3307, poste local seulement (`127.0.0.1`) |
| redis | 6380, poste local seulement |
| mailpit | 8025 (UI), 1025 (SMTP), poste local seulement |
| django | 8000, poste local seulement (`127.0.0.1`, depuis le 2026-10-22 : serveur de développement en DEBUG) |
| frontend (Vite, image `node:24-alpine`, `pull_policy: always` ; Node ≥ 24.22.1 imposé par `engines` + `.npmrc` `engine-strict`) | 5173, poste local seulement (les téléphones passent par le proxy HTTPS) |
| proxy (Caddy) | 443 poste local seulement (`flex-checking.localhost`) ; **8443 ouvert au réseau local** (scan sur téléphone) |

## Images et espace disque (2026-10-22)
- `backend/Dockerfile` en plusieurs étapes : `construction` (compilateurs, `mysqlclient`) → `base` (Python + `libmariadb3`
  seulement, environnement `/opt/venv` copié) → `dev` / `prod`. Mesuré le 2026-10-22 : image `prod` **558 Mo**
  (≈ 1 Go avant), `dev` 617 Mo ; aucun compilateur dans l'image livrée ; utilisateur `flex` ; 264 tests passés dans
  l'image `dev`, contrôle de santé 200 avec l'image `prod`.
- Développement : une seule image `flex-checking-backend:dev` pour django, celery et celery-beat.
- Journaux des conteneurs plafonnés (`x-journaux` : 3 × 10 Mo par service) dans les deux fichiers compose ; journaux
  binaires MySQL gardés 7 jours (`--binlog-expire-logs-seconds=604800`, dev et prod ; 3 jours envisagés puis portés à
  7 par la revue de code du 2026-10-22, tant que les sauvegardes ne sont pas automatisées dans le dépôt).
- Ménage sans perte de données (garde les volumes nommés `mysql-data`, `frontend-node-modules`) :
  `docker compose down` · `docker image prune` · `docker builder prune -af` · `docker volume prune` (volumes
  anonymes inutilisés seulement). Ne jamais lancer `docker compose down -v` ni `docker volume rm …mysql-data`.
- ⚠️ Docker Desktop se bloque si le disque du Mac est plein (« no space left on device » dans
  `~/Library/Containers/com.docker.docker/Data/log/host/com.docker.backend.log`) : libérer de la place puis relancer.

## Sans Docker (hors MySQL / Redis)
Backend : venv Python 3.12, `requirements-dev.txt` (mysqlclient : `PKG_CONFIG_PATH=/opt/homebrew/opt/mysql-client/lib/pkgconfig`),
`migrate`, `seed_demo`, `CELERY_TASK_ALWAYS_EAGER=1 JWT_COOKIE_SECURE=0 runserver`. Frontend : `npm install`,
`npm run dev` (proxy `/api` → `:8000`, WebSocket compris).

## Données de démonstration (`seed_demo`, idempotent, jamais en production)
- Refusé hors développement (`DEBUG` faux) sauf avec `--force` (environnement de test seulement), depuis le
  2026-10-22.
- Les journaux de `runserver` contiennent l’URL complète, dont la recherche `?q=` (souvent un email) : ne pas les
  partager (R24 de [risques-et-dette](../project/risques-et-dette.md) ; Gunicorn masque en production).
- Comptes : super admin `direction.evenements@mde.ci` ; admins `mariam.kone@`, `kouame.brou@`, `ines.toure@mde.ci`.
  Mots de passe : variables `DEMO_MOT_DE_PASSE_SUPER_ADMIN` / `DEMO_MOT_DE_PASSE_ADMIN`, sinon tirés au hasard
  et affichés une fois ; `--reinitialiser-mots-de-passe` pour les réappliquer.
- Cérémonies : AMP de l’année **le jour même** (accueil 2 h avant, 40 invités dont 24 présents, 2 emails en échec),
  PMD (inscriptions ouvertes), Public-AMP, Public-ASD, éditions 2023–2025 d’AMP et PMD.
- Aucune date d’inscription dans le futur : pour une cérémonie à venir, les inscriptions sont réparties sur les
  30 derniers jours (`test_dates_inscription.py::test_seed_demo_sans_date_future`).
- Sondage de satisfaction déjà passé sur les éditions 2025 d’AMP et PMD (~45 % de réponses, commentaires).

## Variables d’environnement (noms seulement)
`DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `APP_PUBLIC_URL`, `NUM_PROXIES`,
`MYSQL_*`, `DB_HOST`, `DB_PORT`, `DATABASE_URL`, `DB_SSLMODE`, `DB_POOL` (Postgres : pool de connexions, actif par défaut, `0` pour le couper), `REDIS_URL`, `REDIS_CACHE_URL`, `EMAIL_*`,
`DEFAULT_FROM_EMAIL` (adresse seule : le nom d’expéditeur vient des paramètres), `JWT_ACCESS_MINUTES`, `JWT_REFRESH_HOURS`, `JWT_COOKIE_SECURE`, `CELERY_TASK_ALWAYS_EAGER`,
`LIMITE_ANONYME`, `LIMITE_COMPTE`, `LIMITE_INSCRIPTION_IP`, `WEB_CONCURRENCY`, `DB_CONCURRENCE`, `ATTENTE_MAX`,
`EXPORT_SEUIL_ASYNCHRONE`, `CRON_SECRET` (cron Vercel du sondage, lu dans `backend/config/settings.py` ; absent de
`.env.example`, inutile en local où Celery Beat envoie les sondages), `DEMO_MOT_DE_PASSE_*`. Modèle : `.env.example`.
`.gitignore` exclut `.env` et `.env.*` (sauf `.env.example`), les clés (`*.key`, `*.p12`, `*.pfx`), les sauvegardes
SQL (`*.sql`, `*.sql.gz`, `sauvegardes/`) et `.claude/settings.local.json`.

## Tester le scan sur un téléphone
README §6 : certificat mkcert pour l’IP, autorité mkcert installée sur le téléphone, `https://<IP>:8443/scan`,
ajout à l’écran d’accueil (PWA). QR de test : fiche invité de l’admin ou email n°1 (Mailpit).
