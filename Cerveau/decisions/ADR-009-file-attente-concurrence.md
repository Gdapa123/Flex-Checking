---
type: decision
statut: acceptée
verifie: 2026-10-26
commit: d220011
sources: [backend/config/bases.py, backend/config/settings.py, backend/config/concurrence.py, backend/config/asgi.py, backend/apps/noyau/consumers.py, docker-compose.prod.yml, infra/charge/README.md]
---

# ADR-009 — File d’attente devant Django pour borner les connexions à la base

- **Date** : 2026-10-12 (commit `b2e1a36`)
- **Statut** : acceptée

## Contexte
Sous ASGI, chaque requête ouvre sa propre connexion MySQL (`CONN_MAX_AGE = 0`). Lors des tests de charge, un pic
(1 000 ouvertures du lien) dépassait `max_connections` : 12 à 65 % d’erreurs 500.

## Décision
Middleware ASGI `LimiteConcurrence` : sémaphore de `DB_CONCURRENCE` (24) requêtes HTTP par processus ; les
suivantes attendent ; au-delà de `ATTENTE_MAX` (20 s) → 503 `SERVICE_SATURE` + `Retry-After: 5`. Le contrôle de
santé n’attend jamais. Même borne pour les accès base des connexions WebSocket.
Dimensionnement : `WEB_CONCURRENCY × DB_CONCURRENCE × conteneurs < max_connections` (600 en prod).

## Conséquences
- ➕ 100 % de réussite aux tests de charge ; l’utilisateur attend au lieu d’échouer.
- ➖ latence plus élevée en pic (p95 4,2 s pour 500 inscriptions simultanées).
- **Complément Postgres (2026-10-26, non commité)** : avec `DATABASE_URL` Postgres (Vercel + Neon), les connexions
  sont réutilisées par le pool natif de Django (`config/bases.py`, `base_depuis_url(pool_max=…)` / `pool_postgres` ;
  dépendance `psycopg-pool`) : au plus `DB_CONCURRENCE + 2` par processus (marge pour le contrôle de santé, hors
  file), une connexion prête, inactives fermées après 240 s, durée de vie 30 min, `CONN_HEALTH_CHECKS` (connexion
  coupée par la mise en veille de Neon remplacée avant usage), attente du pool 10 s au plus. Mêmes options de
  connexion (TLS, `channel_binding`). `DB_POOL=0` le désactive. MySQL (production) n'a pas de pool natif dans
  Django : inchangé (`CONN_MAX_AGE = 0`, base sur le réseau local du compose). Mesure locale : 100 appels de
  `/api/sante/` (dont 50 simultanés) ouvrent 10 connexions au lieu de 100.
