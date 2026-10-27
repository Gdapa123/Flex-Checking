---
type: architecture
statut: implémenté
verifie: 2026-10-27
commit: bed9942
sources: [backend/config/settings.py, backend/config/asgi.py, backend/config/concurrence.py, backend/gunicorn.conf.py, docker-compose.yml, docker-compose.prod.yml, infra/Caddyfile, infra/Caddyfile.prod, frontend/vite.config.js, frontend/vercel.json, backend/vercel.json, backend/apps/noyau/logs.py, frontend/src/App.jsx, backend/Dockerfile]
---

# Vue d’ensemble du système

```
Navigateur (React 18 + Vite, PWA)
   │  HTTPS  /api/*  (cookies JWT httpOnly + en-tête X-CSRFToken)
   │  WSS    /api/ws/ (même cookie)
   ▼
Caddy (TLS, compression, répartition) ── fichiers statiques du frontend (prod)
   ▼
Gunicorn + workers Uvicorn (ASGI)  ── config.asgi
   ├─ HTTP  → LimiteConcurrence (file d’attente, 24 requêtes/processus) → Django + DRF
   └─ WS    → AllowedHostsOriginValidator → TempsReelConsumer (Channels)
   │
   ├── MySQL 8 (utf8mb4, UTC)           données
   ├── Redis base 0                      broker Celery + relais Channels
   ├── Redis base 1                      cache (stats, page publique, analyses, limites, mesures)
   └── Celery worker + beat              emails, actions groupées, exports lourds, relances, purges,
                                         sondage de satisfaction (email n°3, chaque heure de 8 h à 20 h),
                                         anonymisation des données expirées (3 h 30)
```

## Couches backend (`backend/`)
| Couche | Où | Rôle |
|---|---|---|
| Configuration | `config/` | settings par variables d’env, URL racine, ASGI, Celery, file de concurrence, bases |
| Comptes | `apps/comptes/` | modèle `Admin` (AUTH_USER_MODEL), JWT en cookies, permissions, limites de débit |
| Règles métier | `apps/noyau/services.py` | inscription, émargement, annulation, états d’ouverture |
| API | `apps/noyau/vues_*.py` | public, scan, invités, super admin, erreurs, sondage (`vues_sondage.py`) |
| Diffusion | `temps_reel.py`, `consumers.py` | signaux → notifications après commit → WebSocket |
| Emails | `emails.py`, `tasks.py`, `suivi_emails.py`, `sondages.py`, `templates/emails/` | rendu HTML/texte des trois emails, envoi Celery, relances, suivi des envois, sondage planifié |
| Transverse | `journal.py`, `erreurs.py`, `mesures.py`, `caches.py`, `validation.py`, `logs.py` | journal d’activité, erreurs techniques, métriques, cache, validation, masquage PII |
| Données personnelles | `donnees_personnelles.py` | anonymisation des invités après la durée de conservation ([donnees-personnelles](../features/donnees-personnelles.md)) |

Détail : [components](components.md).

## Couches frontend (`frontend/src/`)
| Couche | Où |
|---|---|
| Entrée et routes | `main.jsx` (QueryClient, `FiletErreur`, signalement), `App.jsx` (routes paresseuses, `RequireRole` ; code des espaces protégés préchargé pendant `/auth/moi/` : `chargerAdmin`, `chargerScan`, `chargerSuper`) |
| Bibliothèque | `lib/` : `api.js`, `tempsReel.js`, `format.js`, `schemas.js`, `agenda.js`, `telechargement.js`, `useUrlState.js`, `useTitre.js`, `signalement.js` |
| Thème | `theme/tokens.js`, `theme/ThemeScope.jsx`, `styles/tokens.css` (seul fichier de couleurs) |
| Primitives UI | `components/ui/` (Bouton, Champ, Segmente, Dialogue, PanneauLateral, Toasts…) |
| Espaces | `features/invite`, `scan`, `admin`, `invites` (partagé admin/super), `super`, `auth` |

## Principes transverses
- **Le serveur est l’arbitre** : toute règle (capacité, idempotence, droits) est appliquée côté serveur ;
  le frontend ne fait que de la validation de confort.
- **Après commit** : emails et notifications temps réel partent via `transaction.on_commit`.
- **Dégradation sans panne visible** : Redis, Celery, WebSocket ou réseau indisponibles → l’action principale
  (inscription, scan) réussit quand même (voir [non-functional-requirements](../specifications/non-functional-requirements.md)).
- **Aucune donnée personnelle** dans le journal, les logs, les messages WebSocket, les QR codes. Les logs masquent
  aussi la recherche `?q=` et le jeton du sondage (`logs.masquer_jetons`, filtre `regexp` de `infra/Caddyfile.prod`).
- **En-têtes** : `Referrer-Policy: same-origin` (Django, Caddy prod, `frontend/vercel.json`), `X-Frame-Options: DENY`
  côté Django (`SAMEORIGIN` côté Caddy prod) ; API en JSON uniquement (parseur multipart retiré) ; seule exception, `POST public/sondages/<jeton>/reponse/` (formulaire de l'email n°3, sans authentification).

## Environnements
| Environnement | Base | Redis / Celery | Fichier |
|---|---|---|---|
| Dev Docker | MySQL (port hôte 3307, lié à `127.0.0.1`) | oui (6380, `127.0.0.1`) + Mailpit ; frontend `node:24-alpine` re-téléchargé à chaque démarrage (`pull_policy: always`, minimum 24.22.1 imposé par `frontend/package.json`), port 5173 sur `127.0.0.1` ; journaux des conteneurs plafonnés (3 × 10 Mo) | `docker-compose.yml` |
| Dev sans Docker | MySQL/Redis du compose | Celery eager possible | README §2 |
| Test en ligne | Postgres Neon (`DATABASE_URL`) | **non** ; sondage puis anonymisation déclenchés par deux crons Vercel (8 h et 12 h, `backend/vercel.json`, secret `CRON_SECRET`) | Vercel, `backend/Dockerfile.vercel` |
| Production | MySQL (journaux binaires 7 jours) | oui ; image backend en plusieurs étapes, sans compilateur (`backend/Dockerfile`, cible `prod`) ; journaux des conteneurs plafonnés | `docker-compose.prod.yml` |

Voir [deployment](../operations/deployment.md).
