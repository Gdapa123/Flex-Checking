---
type: testing
statut: implémenté
verifie: 2026-10-26
commit: 2523cbb
sources: [backend/apps/noyau/tests/test_audit_securite.py, backend/apps/noyau/tests/test_temps_reel.py, backend/apps/noyau/tests/test_durcissement.py, backend/apps/noyau/tests/test_donnees_personnelles.py, frontend/tests/confidentialite.test.jsx, frontend/e2e/accessibilite.spec.js, frontend/tests/fileHorsLigne.test.js, backend/apps/noyau/tests/, frontend/tests/, frontend/e2e/]
---

# Cas de test par domaine

Correspondance entre les fichiers de test et les fonctionnalités. Les noms de tests décrivent le comportement attendu.
Volumes : voir [test-strategy](test-strategy.md) (273 tests backend exécutés le 2026-10-27 sur MySQL, 69 Vitest dans 16 fichiers, 3 Playwright).

## Backend (`backend/apps/noyau/tests/`)
| Fichier | Couvre | Page |
|---|---|---|
| `test_inscription.py` | infos publiques, lien invalide, inscription + email 1, refus par état et date limite, doublon (même réponse + renvoi), renvois automatiques limités, consentement, validation, renvoi du QR, unicité des codes, .ics, agenda, entreprise/fonction obligatoires | [inscription](../features/inscription.md) |
| `test_emargement.py` | premier passage + magazine, idempotence, invalide / autre événement, un seul champ, annulation réservée au super admin et sans second magazine, magazine inactif, hors ligne (date client, rejeu), limitation des codes (non contournable par le poste, codes valides jamais bloqués), récents, **concurrence**, droits | [scan](../features/scan-emargement.md), [hors-ligne](../features/hors-ligne.md) |
| `test_emails.py` | échec après 3 relances, variables et échappement, lien magazine en clair, envoi, boutons vers infos pratiques | [emails](../features/emails.md) |
| `test_invites.py` | compteurs et pagination, recherche (dont code), filtres et tris, ajout manuel, modification + historique, renvoi, actions groupées (synchrones, Celery > 50), exports CSV/XLSX, export async, QR, statistiques (tranche en cours calculée par le serveur), renvois groupés limités par heure, formules neutralisées, purge, renvoi du magazine refusé s'il est désactivé | [gestion-invites](../features/gestion-invites.md) |
| `test_permissions.py` | non connecté, cookies httpOnly, mauvais mot de passe + limite, CSRF, compte désactivé, rafraîchir/déconnexion, périmètre admin, X-Forwarded-For falsifié, limite par compte | [authentification](../features/authentification.md) |
| `test_securite.py` | révocation des sessions (réinitialisation, changement, WebSocket), mot de passe temporaire bloquant, identifiants non numériques, corps non-objet, caractères de contrôle, .ics, formules, journal d’accès sans recherche, santé, vérification et changement du mot de passe limités par compte (dont mot de passe de l'hôte) | [non-functional](../specifications/non-functional-requirements.md) |
| `test_temps_reel.py` | fermetures 4001/4003/4004 (sans relais temps réel), origine, périmètre des notifications, désactivation en cours, affectation, déconnexion qui ferme le WebSocket de la session | [temps-reel](../features/temps-reel.md) |
| `test_super_admin.py` | programmes, couleurs, cérémonies (slug, QR), dates incohérentes, comptes, paramètres et aperçu, journal, exports globaux, tous les invités, mot de passe, schéma OpenAPI, ancien lien lisible | [super admin](../features/configuration-super-admin.md) |
| `test_suppressions.py` | confirmation par le nom, cascade programme, compte supprimé et historique, garde-fous, dernier super admin, suppression d’invités réservée | [super admin](../features/configuration-super-admin.md) |
| `test_analytique.py` | rapports PDF et droits, analyses (taux limités aux cérémonies terminées), caches exacts, page publique en cache et ancien lien coupé, places restantes, santé, limite de connexion si Redis tombe, file indisponible, relance, docs API, limite des rapports | [exports-rapports](../features/exports-rapports.md) |
| `test_erreurs.py` | regroupement et masquage, signalement invalide, 500 neutre, échec email, réouverture, droits | [erreurs-techniques](../features/erreurs-techniques.md) |
| `test_deploiement.py` | options Postgres conservées, chiffrement par défaut, MySQL, pool Postgres sans changement de chiffrement (`test_pool_postgres_garde_le_chiffrement`), limites partagées entre instances, envoi sans file, compteur de codes partagé | [ADR-007](../decisions/ADR-007-environnement-test-vercel.md) |
| `test_audit_securite.py` | emails non ASCII refusés (connexion, inscription, renvoi), seuls les échecs comptent par compte, limite par IP, CSRF de la connexion, multipart refusé, jeton d'accès révoqué à la déconnexion, poste connu infalsifiable, compteur en base avec fenêtre, IPv6 regroupé par /64, CSRF du rafraîchissement, session borne (routes refusées / autorisées, recherche réduite, rafraîchissement, élévation, « C’est moi » limité aux noms proposés, ni hôtes ni lien d'inscription), renvois d'email limités, jetons et traces masqués dans les journaux, poste connu limité à son propre compteur, rafraîchissements simultanés sans déconnexion (409) | [authentification](../features/authentification.md), [scan](../features/scan-emargement.md) |
| `test_dates_inscription.py` | inscription jamais datée dans le futur (modèle), `seed_demo --force` sans date future, migration 0008 supprimant les inscriptions futures | [inscription](../features/inscription.md) |
| `test_sondage.py` | envoi le lendemain aux seuls présents, programme désactivé, rattrapage, envoi sans file dans un budget puis reprise, jamais après clôture ni annulation, cron protégé par `CRON_SECRET`, lecture du lien, réponse unique par lien et par appareil, lien expiré, validation, résultats et droits, suivi et renvoi, email de test et aperçu, anonymat en base, section du rapport PDF, caractères de contrôle du commentaire refusés, formulaire intégré à l'email (présence dans l'email, réponse, incomplet, clos, lien inconnu, commentaire nettoyé, notes converties, formulaire falsifié ou injection SQL) | [sondage-satisfaction](../features/sondage-satisfaction.md) |
| `test_suivi_emails.py` | compteurs et échecs, droits (admins de la cérémonie, super admin), renvoi des seuls échecs, magazine non renvoyé aux invités plus présents, magazine désactivé, email de test (dont SMTP indisponible), type invalide | [emails](../features/emails.md) |
| `test_durcissement.py` (2026-10-22) | sessions fermées à la désactivation, codes limités à la borne, modèles d'emails enregistrés (bug `JSON_UNDERSCOREIZE`), caractères de contrôle refusés, variables remplacées en une seule passe, `Message-ID` stable, renvoi du sondage identique que l'invité ait répondu ou non (réponse, email, statut), `Message-ID` incluant l'hôte public, relance d'une tentative perdue seulement si la dernière date de plus d'1 h (`derniere_tentative_le`), scan hors ligne rejoué après annulation (`ANNULE_DEPUIS`, y compris rejeu de plus de 12 h), jeton « C’est moi » valable 5 min à l'heure du passage hors ligne, concurrence sur la dernière place, `seed_demo` refusé hors développement | [emails](../features/emails.md), [scan](../features/scan-emargement.md), [authentification](../features/authentification.md) |
| `test_donnees_personnelles.py` (2026-10-22) | calcul des mois, anonymisation après la durée de conservation, durée réglable, page de confidentialité publique, réglages réservés au super admin, emails renvoyant vers la politique, cron sans file qui anonymise aussi, invités ajoutés après une anonymisation et motifs d'annulation effacés | [donnees-personnelles](../features/donnees-personnelles.md) |
| `test_theme.py` | tokens de référence, contrastes, couleur de texte, Argon2 en production | — |

## Frontend (`frontend/tests/`)
`tokens`, `schemas`, `format`, `agenda`, `connexion` (chemin interne), `garde` (401, 503, hors ligne),
`confirmation` (scrollTo renvoyant une promesse), `tableauDeBord` (abréviations PAMP/PASD, graphique des arrivées vide ou rempli), `resultat` (résultat de scan), `signalement`, `tempsReel`, `analyses`,
`sondage` (trois questions obligatoires, lien expiré, délai dépassé pendant la saisie, appareil déjà utilisé, déjà
répondu, indicateurs et commentaires, jeton jamais transmis aux signalements), `suiviEmails` (compteurs, échecs et
renvoi après confirmation, email de test, emails désactivés, carte de l'email n°3), `fileHorsLigne` (2026-10-22 :
retrait d'un « C’est moi » expiré `CHOIX_BORNE_INVALIDE` puis rejeu des suivants ; arrêt sur un autre 403), `confidentialite` (2026-10-22 : durée et contact affichés, validation des réglages 1 à 60 mois et email facultatif).

## E2E (`frontend/e2e/`)
- `parcours.spec.js` (2 tests) : inscription → email 1 → scan par code → Présent → email 2 → tableau admin → export,
  découpé en étapes `test.step` ; temps réel (une inscription apparaît chez l’admin sans rechargement). Aides
  `evenementPmdOuvert` / `urlInvites`, fixtures `browser` / `baseURL` (refactorisation du 2026-10-21, commitée dans
  `d91d426`) ; exécuté avec succès le 2026-10-22 (voir [test-strategy](test-strategy.md)).
- `accessibilite.spec.js` : audit axe-core des écrans principaux, dont `/confidentialite` (iframes d'aperçu d'email exclues).

## Non couvert (constaté)
- Sessions (constaté le 2026-10-26) : la déconnexion est testée pour la révocation du jeton d'accès, le maintien
  des autres appareils en HTTP (`test_audit_securite.py::test_deconnexion_revoque_le_jeton_d_acces`) et la fermeture
  4001 du WebSocket **de la session** (`test_temps_reel.py::test_deconnexion_ferme_le_temps_reel_de_la_session`) ;
  aucun test ne vérifie que les connexions temps réel des **autres** appareils du compte restent ouvertes. La course
  entre onglets n'est testée que par le 409 puis le refus après 5 min
  (`test_rafraichissements_simultanes_sans_deconnexion`) : pas de test de la limite aux jetons émis dans la
  fenêtre de la rotation.
- File IndexedDB (`fileHorsLigne.js`) : seul `rejouer` est testé (Vitest, avec dépendances simulées) ; pas de test
  dans un vrai navigateur, ni de `purgerAnciens`.
