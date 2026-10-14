---
type: specification
statut: implémenté
verifie: 2026-10-14
commit: 36389e6
sources: [backend/config/settings.py, backend/config/concurrence.py, backend/apps/noyau/middleware.py, backend/apps/comptes/throttles.py, infra/charge/README.md, frontend/e2e/accessibilite.spec.js]
---

# Exigences non fonctionnelles

## Sécurité
| ID | Exigence | Mise en œuvre |
|---|---|---|
| ENF-S1 | Mots de passe forts et hachés | Argon2, ≥ 10 caractères, `CommonPasswordValidator` |
| ENF-S2 | Sessions non volables par script et révocables | JWT en cookies httpOnly, CSRF, `version_session` ([authentification](../features/authentification.md)) |
| ENF-S3 | Droits appliqués côté serveur | `CompteUtilisable` par défaut, `evenements_visibles` sur chaque queryset |
| ENF-S4 | Limites anti-abus | voir tableau ci-dessous ; IP réelle via `NUM_PROXIES` (X-Forwarded-For non falsifiable) |
| ENF-S5 | Pas de fuite de données personnelles | QR = jeton anonyme ; journal, logs (filtres `MasquerDonneesPersonnelles`, `MasquerParametresUrl`), WebSocket et erreurs sans email ni téléphone |
| ENF-S6 | En-têtes de sécurité | CSP stricte, HSTS (prod), `nosniff`, `Referrer-Policy`, `Permissions-Policy` (caméra même site), COOP, `X-Frame-Options` ; API en `no-store` |
| ENF-S7 | Entrées durcies | caractères de contrôle refusés, corps JSON non-objet ignoré, identifiants non numériques → 400, .ics échappé, formules neutralisées |
| ENF-S8 | Documentation API réservée | `/api/docs/` et `/api/schema/` : super admin seulement |
| ENF-S10 | Poste public (borne) | session restreinte côté serveur, mot de passe de l'hôte pour les réglages ([ADR-010](../decisions/ADR-010-mode-borne-serveur.md)) |
| ENF-S11 | Pas de confusion d'identité par Unicode | emails ASCII uniquement (collation insensible aux accents) |
| ENF-S9 | Secrets hors dépôt | `.env` non commité, `DJANGO_SECRET_KEY` ≥ 32 caractères obligatoire hors debug, mots de passe de démo par variables |

### Limites de débit (valeurs du code)
| Portée | Limite |
|---|---|
| anonyme (global, par IP) | 600/min (`LIMITE_ANONYME`) |

Toutes les limites par IP comptent une IPv4 ou un **préfixe IPv6 /64** (`throttles.ident_reseau`).

| Portée | Limite |
|---|---|
| compte (global) | 1 200/min (`LIMITE_COMPTE`) |
| connexion | 5/min par IP + email ; 30/min par IP ; 20 **échecs**/h par compte visé, sauf poste connu (cookie signé) |
| vérification / changement du mot de passe (compte connecté) | 5/min et 30/h par compte |
| renvoi d'email par un admin | 5/h par compte et par invité |
| recherche de la borne | 30/min par compte ; chaque mot ≥ 3 caractères |
| inscription | 60/h par IP (`LIMITE_INSCRIPTION_IP`) |
| renvoi du QR | 3/h par email et **cérémonie** (anciens liens compris) ; 30/h par IP |
| renvoi automatique (doublon d’inscription) | 3/h par adresse et cérémonie |
| codes invalides au scan | 30 en 10 min par compte et cérémonie |
| signalement d’erreur navigateur | 30/min |
| rapports PDF | 30/h par compte |
| page publique du sondage | 60/h par IP |
| email de test (A7) | 10/h par compte |
| renvoi groupé des échecs (A7) | 10/h par compte |
| renvoi groupé de l'invitation (liste des invités) | 5/h par compte ; jamais deux invitations en moins d'1 h à un invité |
| « C’est moi » sur la borne | 12/min par compte et cérémonie, jeton de recherche exigé |

Les limites sensibles (connexion, renvoi, codes, mot de passe) et les limites par IP des points d'accès publics
(inscription, renvoi, signalement : `LimiteIpPartagee`) passent par `CacheDeSecours` : Redis, et mémoire locale si Redis tombe
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
| File Celery | l’inscription ou le scan réussit ; l’email reste « en attente » et est relancé |
| Redis | pas de cache ni de temps réel ; limites en mémoire locale ; interrogation périodique |
| WebSocket | reconnexion progressive, rechargement complet |
| Réseau au scan | file IndexedDB, synchronisation |
| Erreur imprévue | message neutre, détail chez le super admin |
| Conteneurs | `restart: unless-stopped`, contrôles de santé (`/api/sante/` indépendant de l’en-tête Host) |

## Accessibilité
WCAG 2.1 AA visé : audit axe-core dans Playwright (`frontend/e2e/accessibilite.spec.js`), focus piégé dans les
dialogues, `aria-live` pour toasts et résultats de scan, cibles ≥ 44 px, contrôles de contraste des couleurs de programme.

## Compatibilité
Mobile d’abord (invité, scan), PWA installable, HTTPS obligatoire pour la caméra hors localhost ; emails
compatibles Gmail / Outlook (tables, PNG, pas de SVG).

## Localisation
Français uniquement, fuseau `Africa/Abidjan`, formats « 18h42 », « Samedi 14 novembre 2026 », écriture « Inscrit·e ».
