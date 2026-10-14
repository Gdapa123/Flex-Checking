---
type: operations
statut: implémenté
verifie: 2026-10-14
commit: cd82ad8
sources: [README.md, docker-compose.yml, .env.example, infra/certs.sh, infra/Caddyfile, backend/apps/noyau/management/commands/seed_demo.py]
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
| mysql | 3307 |
| redis | 6380 |
| mailpit | 8025 (UI), 1025 (SMTP), poste local seulement |
| django | 8000 |
| frontend (Vite) | 5173 |
| proxy (Caddy) | 443, 8443 |

## Sans Docker (hors MySQL / Redis)
Backend : venv Python 3.12, `requirements-dev.txt` (mysqlclient : `PKG_CONFIG_PATH=/opt/homebrew/opt/mysql-client/lib/pkgconfig`),
`migrate`, `seed_demo`, `CELERY_TASK_ALWAYS_EAGER=1 JWT_COOKIE_SECURE=0 runserver`. Frontend : `npm install`,
`npm run dev` (proxy `/api` → `:8000`, WebSocket compris).

## Données de démonstration (`seed_demo`, idempotent, jamais en production)
- Comptes : super admin `direction.evenements@mde.ci` ; admins `mariam.kone@`, `kouame.brou@`, `ines.toure@mde.ci`.
  Mots de passe : variables `DEMO_MOT_DE_PASSE_SUPER_ADMIN` / `DEMO_MOT_DE_PASSE_ADMIN`, sinon tirés au hasard
  et affichés une fois ; `--reinitialiser-mots-de-passe` pour les réappliquer.
- Cérémonies : AMP de l’année **le jour même** (accueil 2 h avant, 40 invités dont 24 présents, 2 emails en échec),
  PMD (inscriptions ouvertes), Public-AMP, Public-ASD, éditions 2023–2025 d’AMP et PMD.
- Aucune date d’inscription dans le futur : pour une cérémonie à venir, les inscriptions sont réparties sur les
  30 derniers jours (`test_dates_inscription.py::test_seed_demo_sans_date_future`).

## Variables d’environnement (noms seulement)
`DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `APP_PUBLIC_URL`, `NUM_PROXIES`,
`MYSQL_*`, `DB_HOST`, `DB_PORT`, `DATABASE_URL`, `DB_SSLMODE`, `REDIS_URL`, `REDIS_CACHE_URL`, `EMAIL_*`,
`DEFAULT_FROM_EMAIL`, `JWT_ACCESS_MINUTES`, `JWT_REFRESH_HOURS`, `JWT_COOKIE_SECURE`, `CELERY_TASK_ALWAYS_EAGER`,
`LIMITE_ANONYME`, `LIMITE_COMPTE`, `LIMITE_INSCRIPTION_IP`, `WEB_CONCURRENCY`, `DB_CONCURRENCE`, `ATTENTE_MAX`,
`EXPORT_SEUIL_ASYNCHRONE`, `DEMO_MOT_DE_PASSE_*`. Modèle : `.env.example`.

## Tester le scan sur un téléphone
README §6 : certificat mkcert pour l’IP, autorité mkcert installée sur le téléphone, `https://<IP>:8443/scan`,
ajout à l’écran d’accueil (PWA). QR de test : fiche invité de l’admin ou email n°1 (Mailpit).
