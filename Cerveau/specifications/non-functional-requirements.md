---
type: specification
statut: implémenté
verifie: 2026-10-26
commit: 44eceb5
sources: [docker-compose.yml, docker-compose.prod.yml, backend/Dockerfile, frontend/package.json, frontend/.npmrc, backend/apps/noyau/tasks.py, backend/apps/noyau/emails.py, backend/apps/noyau/donnees_personnelles.py, .gitignore, .github/workflows/ci.yml, backend/apps/noyau/validation.py, frontend/src/lib/schemas.js, backend/config/settings.py, backend/config/bases.py, backend/config/concurrence.py, backend/apps/noyau/middleware.py, backend/apps/comptes/throttles.py, backend/apps/noyau/vues_scan.py, backend/apps/noyau/vues_invites.py, backend/apps/noyau/vues_sondage.py, backend/apps/noyau/logs.py, infra/Caddyfile.prod, frontend/vercel.json, infra/charge/README.md, frontend/e2e/accessibilite.spec.js]
---

# Exigences non fonctionnelles

## Sécurité
| ID | Exigence | Mise en œuvre |
|---|---|---|
| ENF-S1 | Mots de passe forts et hachés | Argon2, ≥ 10 caractères, `CommonPasswordValidator` |
| ENF-S2 | Sessions non volables par script et révocables | JWT en cookies httpOnly, CSRF, `version_session` ([authentification](../features/authentification.md)) |
| ENF-S3 | Droits appliqués côté serveur | `CompteUtilisable` par défaut, `evenements_visibles` sur chaque queryset |
| ENF-S4 | Limites anti-abus | voir tableau ci-dessous ; IP réelle via `NUM_PROXIES` (X-Forwarded-For non falsifiable) |
| ENF-S5 | Pas de fuite de données personnelles | QR = jeton anonyme ; journal, logs (filtres `MasquerDonneesPersonnelles`, `MasquerParametresUrl`), WebSocket et erreurs sans email ni téléphone ; jeton du lien de sondage masqué dans les journaux (`logs.JETON_SONDAGE_RE`, filtre de `infra/Caddyfile.prod`) |
| ENF-S6 | En-têtes de sécurité | CSP stricte (`frame-src 'self' blob:`, sans `data:`), HSTS (prod), `nosniff`, `Referrer-Policy: same-origin` (Django, Caddy, `frontend/vercel.json`), `Permissions-Policy` (caméra même site), COOP, `X-Frame-Options` (`DENY` pour l'API, `SAMEORIGIN` pour le frontend) ; API en `no-store` |
| ENF-S7 | Entrées durcies | caractères de contrôle refusés (étendu le 2026-10-22 au nom du programme, aux objets des emails n°1-3, au `poste` du scan, aux motifs d'annulation ; commentaire du sondage : `sans_controle_multiligne`, sauts de ligne et tabulation admis, miroir Zod `CONTROLE_MULTILIGNE_RE`), variables d'email remplacées en une seule passe, corps JSON non-objet ignoré, identifiants non numériques → 400, .ics échappé, formules neutralisées |
| ENF-S8 | Documentation API réservée | `/api/docs/` et `/api/schema/` : super admin seulement |
| ENF-S10 | Poste public (borne) | session restreinte côté serveur, mot de passe de l'hôte pour les réglages ([ADR-010](../decisions/ADR-010-mode-borne-serveur.md)) |
| ENF-S11 | Pas de confusion d'identité par Unicode | emails ASCII uniquement (collation insensible aux accents) |
| ENF-S9 | Secrets hors dépôt | `.env` non commité, `DJANGO_SECRET_KEY` ≥ 32 caractères obligatoire hors debug, mots de passe de démo par variables ; `.gitignore` renforcé le 2026-10-22 (`.env.*` sauf `.env.example`, `*.key`, `*.p12`, `*.pfx`, sauvegardes `*.sql`, `*.sql.gz`, `sauvegardes/`, `.claude/settings.local.json`) ; audit du 2026-10-22 : aucun secret réel dans le dépôt ni dans l'historique ; `seed_demo` refusé hors `DEBUG` sans `--force` |
| ENF-S12 | Surface réseau minimale | développement (`docker-compose.yml`) : Django 8000 et Caddy 443 publiés sur `127.0.0.1` seulement, 8443 ouvert au réseau local (scan sur téléphone) ; production (`docker-compose.prod.yml`) : seuls 80/443 (TCP et UDP) de Caddy publiés ; CI : jeton GitHub en `permissions: contents: read` |
| ENF-S13 | Conservation limitée des données personnelles | anonymisation automatique des invités des cérémonies plus anciennes que `duree_conservation_mois` (défaut 12), chaque nuit (Beat 3 h 30) ou par le cron Vercel ; politique publique `/confidentialite` ([donnees-personnelles](../features/donnees-personnelles.md), [ADR-013](../decisions/ADR-013-conservation-limitee-anonymisation.md)) |
| ENF-S14 | Chaîne de construction à jour | Node.js ≥ 24.22.1 exigé par `frontend/package.json` (`engines`) et `frontend/.npmrc` (`engine-strict=true`), CI sur le dernier correctif 24.x (`check-latest`), image `node:24-alpine` re-téléchargée (`pull_policy: always`) — modifications non commitées au 2026-10-26 ; image backend sans compilateur (étape `construction` séparée, `backend/Dockerfile`) ; images de base non épinglées par empreinte (R22) |

### Limites de débit (valeurs du code)
| Portée | Limite |
|---|---|
| anonyme (global, par IP) | 600/min (`LIMITE_ANONYME`) |

Toutes les limites par IP comptent une IPv4 ou un **préfixe IPv6 /64** (`throttles.ident_reseau`).

| Portée | Limite |
|---|---|
| compte (global) | 1 200/min (`LIMITE_COMPTE`) |
| connexion | 5/min par IP + email ; 30/min par IP ; 20 **échecs**/h par compte visé ; un poste connu (cookie signé) a son propre compteur de 20 échecs/h (2026-10-22) |
| vérification / changement du mot de passe (compte connecté) | 5/min et 30/h par compte |
| renvoi d'email par un admin | 5/h par compte et par invité |
| recherche de la borne | 30/min par compte ; chaque mot ≥ 3 caractères |
| inscription | 60/h par IP (`LIMITE_INSCRIPTION_IP`) |
| renvoi du QR | 3/h par email et **cérémonie** (anciens liens compris) ; 30/h par IP |
| renvoi automatique (doublon d’inscription) | 3/h par adresse et cérémonie |
| codes invalides au scan | 30 en 10 min par compte et cérémonie ; **10** en session borne (`MAX_CODES_INVALIDES_BORNE`) |
| signalement d’erreur navigateur | 30/min |
| rapports PDF | 30/h par compte |
| page publique du sondage | 60/h par IP |
| email de test (A7) | 10/h par compte |
| renvoi groupé des échecs (A7) | 10/h par compte |
| renvoi groupé de l'invitation (liste des invités) | 5/h par compte ; jamais deux invitations en moins d'1 h à un invité |
| « C’est moi » sur la borne | 12/min par compte et cérémonie (`MANUELS_BORNE_PAR_MINUTE`), jeton signé de la recherche exigé (5 min) |
| cron du sondage (Vercel) | pas de limite de débit ; route en 404 sans `CRON_SECRET` valide (≥ 32 caractères) |

Les limites sensibles (connexion, renvoi, codes, mot de passe) et les limites par IP des points d'accès publics
(inscription, renvoi, signalement, sondage : `LimiteIpPartagee`) passent par `CacheDeSecours` : Redis, et mémoire locale si Redis tombe
(jamais de désactivation). Sans Redis (Vercel) : table de cache en base `cache_limites`.

## Performance et charge
- Objectif : plus de 1 000 personnes simultanées. Résultats mesurés le 2026-10-12 (Docker Desktop 8 cœurs,
  4 processus) : 1 000 ouvertures du lien 100 % (p95 941 ms), 500 inscriptions 100 % (p95 4,2 s), 300 tableaux
  de bord 100 %, mixte 1 500 requêtes 100 %, 500 WebSocket notifiés en 0,09 s.
- File d’attente par processus (`config/concurrence.py`, `DB_CONCURRENCE` = 24, attente max 20 s puis 503 +
  `Retry-After: 5`) : borne les connexions MySQL.
- Caches 30 s invalidés à chaque changement : statistiques, page publique, analyses.
- Émargement : ~50 ms (README) ; email n°2 en arrière-plan.

## Résilience
| Panne | Comportement |
|---|---|
| File Celery | l’inscription ou le scan réussit ; l’email reste « en attente » et est relancé (`tasks.relancer_emails_en_attente` : jamais parti depuis 15 min, ou dernière tentative de plus d'1 h, `derniere_tentative_le`, migration `0011`) ; `Message-ID` stable par envoi, incluant l'hôte public et la date de création (base de test ≠ production) contre les doublons |
| Disque MySQL (production) | durabilité InnoDB par défaut (`innodb-flush-log-at-trx-commit=2` retiré de `docker-compose.prod.yml` le 2026-10-22) ; journaux binaires 7 jours (`--binlog-expire-logs-seconds=604800`) |
| Disque plein (journaux) | journaux des conteneurs plafonnés à 3 × 10 Mo par service (`x-journaux`, dev et prod) |
| Redis | pas de cache ni de temps réel ; limites en mémoire locale ; interrogation périodique |
| WebSocket | reconnexion progressive, rechargement complet |
| Réseau au scan | file IndexedDB, synchronisation |
| Erreur imprévue | message neutre, détail chez le super admin |
| Conteneurs | `restart: unless-stopped`, contrôles de santé (`/api/sante/` indépendant de l’en-tête Host) |

## Accessibilité
WCAG 2.1 AA visé : audit axe-core dans Playwright (`frontend/e2e/accessibilite.spec.js`, violations `serious` /
`critical` ; les iframes d'aperçu d'email sont exclues de l'audit), focus piégé dans les
dialogues, `aria-live` pour toasts et résultats de scan, cibles ≥ 44 px, contrôles de contraste des couleurs de programme.

## Compatibilité
Mobile d’abord (invité, scan), PWA installable, HTTPS obligatoire pour la caméra hors localhost ; emails
compatibles Gmail / Outlook (tables, PNG, pas de SVG).

## Localisation
Français uniquement, fuseau `Africa/Abidjan`, formats « 18h42 », « Samedi 14 novembre 2026 », écriture « Inscrit·e ».
