---
type: architecture
statut: implémenté
verifie: 2026-11-09
commit: ebaf617
sources: [backend/config/settings.py, backend/apps/noyau/emails.py, backend/apps/noyau/suivi_emails.py, backend/apps/noyau/vues_sondage.py, frontend/src/lib/agenda.js, frontend/src/features/scan/useCamera.js, frontend/vercel.json, backend/vercel.json, docker-compose.yml, backend/config/bases.py, backend/requirements.txt]
---

# Intégrations externes

| Intégration | Usage | Configuration | Détail |
|---|---|---|---|
| **SMTP** | emails n°1, n°2 et n°3 (sondage) ; email de test envoyé de façon synchrone depuis « Suivi des emails » (`suivi_emails.envoyer_test`) | `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `EMAIL_TIMEOUT` (15 s par défaut, depuis le 2026-11-09 : un SMTP muet ne bloque plus l’email de test ni un worker), `DEFAULT_FROM_EMAIL` | dev : console ou Mailpit ; prod : fournisseur ❓ à confirmer ; `Message-ID` construit avec le domaine de `DEFAULT_FROM_EMAIL` et l’hôte de `APP_PUBLIC_URL` (aucune collision entre test et production) |
| **Mailpit** | boîte de test (dev Docker) | `docker-compose.yml`, http://localhost:8025 | aucun email ne sort |
| **Redis** | broker Celery, relais Channels, cache, limites, métriques | `REDIS_URL` (base 0), `REDIS_CACHE_URL` (base 1 par défaut) | absent → mode dégradé (ADR-007) ; client `redis==5.2.1` avec `kombu==5.6.2` figé (kombu 5.7.0 exige redis-py ≥ 6.1) |
| **Google Agenda / Microsoft 365** | liens « Ajouter à l’agenda » | `lib/agenda.js` | horaires UTC fournis par l’API (`agenda.debut/fin`) |
| **Google Maps** | « Itinéraire » | `lib/agenda.js` | destination = lieu ; « Copier l’adresse » en complément |
| **Fichier .ics** | pièce jointe de l’email n°1, `/agenda.ics` | `noyau/ics.py` | rappel 2 h avant, aucune donnée personnelle |
| **Google Fonts** | police Poppins **dans les emails seulement** | `templates/emails/base.html` | l’application utilise `@fontsource/poppins` auto-hébergée |
| **Caméra (getUserMedia) + ZXing** | lecture des QR | `scan/useCamera.js` | HTTPS obligatoire hors localhost |
| **Vercel** | environnement de test | projets `flex-checking` (frontend) et `flex-checking-api` (backend, région `fra1`) | `frontend/vercel.json` relaie `/api` vers le backend |
| **Vercel Cron** | envoi du sondage sans Celery Beat | `backend/vercel.json` : `/api/taches-planifiees/sondages/?passage=8h` (`0 8 * * *`), `?passage=12h`, `16h` et `20h` (depuis le 2026-11-02) ; variable `CRON_SECRET` (≥ 32 caractères, sinon route désactivée) | `vues_sondage.CronSondagesView` : sondage puis anonymisation des données expirées (pas de Beat sur Vercel) ; horaires des crons en UTC = heure d’Abidjan (UTC+0) |
| **Neon Postgres** | base de l’environnement Vercel | `DATABASE_URL`, `DB_SSLMODE` (défaut `require`) | `config/bases.py` conserve les options de l’URL ; pool de connexions natif de Django (`psycopg-pool`, `DB_POOL`, au plus `DB_CONCURRENCE + 2` par processus, `CONN_HEALTH_CHECKS`) depuis `43f99c5`, voir [ADR-009](../decisions/ADR-009-file-attente-concurrence.md) |
| **mkcert** | HTTPS local (caméra sur téléphone) | `infra/certs.sh` | voir [setup](../operations/setup.md) |

Aucune autre API tierce (pas de paiement, pas de SMS, pas d’analytics externe).
