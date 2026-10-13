---
type: testing
statut: implémenté
verifie: 2026-10-13
commit: dc0c75a
sources: [backend/apps/noyau/tests/, frontend/tests/, frontend/e2e/]
---

# Cas de test par domaine

Correspondance entre les fichiers de test et les fonctionnalités. Les noms de tests décrivent le comportement attendu.

## Backend (`backend/apps/noyau/tests/`)
| Fichier | Couvre | Page |
|---|---|---|
| `test_inscription.py` | infos publiques, lien invalide, inscription + email 1, refus par état et date limite, doublon (même réponse + renvoi), renvois automatiques limités, consentement, validation, renvoi du QR, unicité des codes, .ics, agenda, entreprise/fonction obligatoires | [inscription](../features/inscription.md) |
| `test_emargement.py` | premier passage + magazine, idempotence, invalide / autre événement, un seul champ, annulation sans second magazine, magazine inactif, hors ligne (date client, rejeu), limitation des codes (non contournable par le poste, codes valides jamais bloqués), récents, **concurrence**, droits | [scan](../features/scan-emargement.md), [hors-ligne](../features/hors-ligne.md) |
| `test_emails.py` | échec après 3 relances, variables et échappement, lien magazine en clair, envoi, boutons vers infos pratiques | [emails](../features/emails.md) |
| `test_invites.py` | compteurs et pagination, recherche (dont code), filtres et tris, ajout manuel, modification + historique, renvoi, actions groupées (synchrones, Celery > 50), exports CSV/XLSX, export async, QR, statistiques, formules neutralisées, purge | [gestion-invites](../features/gestion-invites.md) |
| `test_permissions.py` | non connecté, cookies httpOnly, mauvais mot de passe + limite, CSRF, compte désactivé, rafraîchir/déconnexion, périmètre admin, X-Forwarded-For falsifié, limite par compte | [authentification](../features/authentification.md) |
| `test_securite.py` | révocation des sessions (réinitialisation, changement, WebSocket), mot de passe temporaire bloquant, identifiants non numériques, corps non-objet, caractères de contrôle, .ics, formules, journal d’accès sans recherche, santé | [non-functional](../specifications/non-functional-requirements.md) |
| `test_temps_reel.py` | fermetures 4001/4003, origine, périmètre des notifications, désactivation en cours, affectation | [temps-reel](../features/temps-reel.md) |
| `test_super_admin.py` | programmes, couleurs, cérémonies (slug, QR), dates incohérentes, comptes, paramètres et aperçu, journal, exports globaux, tous les invités, mot de passe, schéma OpenAPI, ancien lien lisible | [super admin](../features/configuration-super-admin.md) |
| `test_suppressions.py` | confirmation par le nom, cascade programme, compte supprimé et historique, garde-fous, dernier super admin, suppression d’invités réservée | [super admin](../features/configuration-super-admin.md) |
| `test_analytique.py` | rapports PDF et droits, analyses, caches exacts, page publique en cache et ancien lien coupé, places restantes, santé, limite de connexion si Redis tombe, file indisponible, relance, docs API, limite des rapports | [exports-rapports](../features/exports-rapports.md) |
| `test_erreurs.py` | regroupement et masquage, signalement invalide, 500 neutre, échec email, réouverture, droits | [erreurs-techniques](../features/erreurs-techniques.md) |
| `test_deploiement.py` | options Postgres conservées, chiffrement par défaut, MySQL, limites partagées entre instances, envoi sans file, compteur de codes partagé | [ADR-007](../decisions/ADR-007-environnement-test-vercel.md) |
| `test_audit_securite.py` | emails non ASCII refusés (connexion, inscription, renvoi), seuls les échecs comptent par compte, limite par IP, CSRF de la connexion, multipart refusé, jeton d'accès révoqué à la déconnexion, session borne (routes refusées / autorisées, recherche réduite, rafraîchissement, élévation), renvois d'email limités | [authentification](../features/authentification.md), [scan](../features/scan-emargement.md) |
| `test_theme.py` | tokens de référence, contrastes, couleur de texte, Argon2 en production | — |

## Frontend (`frontend/tests/`)
`tokens`, `schemas`, `format`, `agenda`, `connexion` (chemin interne), `garde` (401, 503, hors ligne),
`confirmation` (scrollTo renvoyant une promesse), `tableauDeBord` (abréviations PAMP/PASD, graphique des arrivées vide ou rempli), `resultat` (résultat de scan), `signalement`, `tempsReel`, `analyses`.

## E2E (`frontend/e2e/`)
- `parcours.spec.js` : inscription → email 1 → scan par code → Présent → email 2 → tableau admin → export ;
  temps réel (une inscription apparaît chez l’admin sans rechargement).
- `accessibilite.spec.js` : audit axe-core des écrans principaux.

## Non couvert (constaté)
- Pas de test automatisé de la file IndexedDB (`fileHorsLigne.js`) côté navigateur.
