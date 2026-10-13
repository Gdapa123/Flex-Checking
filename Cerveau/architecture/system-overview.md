---
type: architecture
statut: implémenté
verifie: 2026-10-13
commit: dc0c75a
sources: [backend/config/settings.py, backend/config/asgi.py, backend/config/concurrence.py, backend/gunicorn.conf.py, docker-compose.yml, docker-compose.prod.yml, infra/Caddyfile, infra/Caddyfile.prod, frontend/vite.config.js, frontend/vercel.json]
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
   └── Celery worker + beat              emails, actions groupées, exports lourds, relances, purges
```

## Couches backend (`backend/`)
| Couche | Où | Rôle |
|---|---|---|
| Configuration | `config/` | settings par variables d’env, URL racine, ASGI, Celery, file de concurrence, bases |
| Comptes | `apps/comptes/` | modèle `Admin` (AUTH_USER_MODEL), JWT en cookies, permissions, limites de débit |
| Règles métier | `apps/noyau/services.py` | inscription, émargement, annulation, états d’ouverture |
| API | `apps/noyau/vues_*.py` | public, scan, invités, super admin, erreurs |
| Diffusion | `temps_reel.py`, `consumers.py` | signaux → notifications après commit → WebSocket |
| Emails | `emails.py`, `tasks.py`, `templates/emails/` | rendu HTML/texte, envoi Celery, relances |
| Transverse | `journal.py`, `erreurs.py`, `mesures.py`, `caches.py`, `validation.py`, `logs.py` | journal d’activité, erreurs techniques, métriques, cache, validation, masquage PII |

Détail : [components](components.md).

## Couches frontend (`frontend/src/`)
| Couche | Où |
|---|---|
| Entrée et routes | `main.jsx` (QueryClient, `FiletErreur`, signalement), `App.jsx` (routes paresseuses, `RequireRole`) |
| Bibliothèque | `lib/` : `api.js`, `tempsReel.js`, `format.js`, `schemas.js`, `agenda.js`, `telechargement.js`, `useUrlState.js`, `signalement.js` |
| Thème | `theme/tokens.js`, `theme/ThemeScope.jsx`, `styles/tokens.css` (seul fichier de couleurs) |
| Primitives UI | `components/ui/` (Bouton, Champ, Segmente, Dialogue, PanneauLateral, Toasts…) |
| Espaces | `features/invite`, `scan`, `admin`, `invites` (partagé admin/super), `super`, `auth` |

## Principes transverses
- **Le serveur est l’arbitre** : toute règle (capacité, idempotence, droits) est appliquée côté serveur ;
  le frontend ne fait que de la validation de confort.
- **Après commit** : emails et notifications temps réel partent via `transaction.on_commit`.
- **Dégradation sans panne visible** : Redis, Celery, WebSocket ou réseau indisponibles → l’action principale
  (inscription, scan) réussit quand même (voir [non-functional-requirements](../specifications/non-functional-requirements.md)).
- **Aucune donnée personnelle** dans le journal, les logs, les messages WebSocket, les QR codes.

## Environnements
| Environnement | Base | Redis / Celery | Fichier |
|---|---|---|---|
| Dev Docker | MySQL (port hôte 3307) | oui (6380) + Mailpit | `docker-compose.yml` |
| Dev sans Docker | MySQL/Redis du compose | Celery eager possible | README §2 |
| Test en ligne | Postgres Neon (`DATABASE_URL`) | **non** | Vercel, `backend/Dockerfile.vercel` |
| Production | MySQL | oui | `docker-compose.prod.yml` |

Voir [deployment](../operations/deployment.md).
