---
type: project
statut: implémenté
verifie: 2026-10-26
commit: d220011
sources: [docker-compose.yml, docker-compose.prod.yml, backend/Dockerfile, frontend/src/features/super/Parametres.jsx, backend/apps/noyau/vues_admin.py, backend/apps/noyau/journal_texte.py, frontend/src/features/invite/ConfidentialitePage.jsx, backend/apps/noyau/migrations/0010_donnees_personnelles.py, backend/apps/noyau/migrations/0011_derniere_tentative.py, backend/apps/noyau/tests/test_durcissement.py, frontend/src/features/invite/EtatCarte.jsx, .env.example, backend/apps/noyau/vues_invites.py, backend/apps/noyau/suivi_emails.py, frontend/src/features/scan/fileHorsLigne.js, frontend/tests/fileHorsLigne.test.js, backend/apps/noyau/tests/test_invites.py, backend/apps/noyau/migrations/0008_inscriptions_pas_dans_le_futur.py, backend/gunicorn.conf.py, infra/Caddyfile.prod, frontend/src/features/scan/ScanPoste.jsx, frontend/src/features/scan/composants.jsx, frontend/src/features/invite/EtatCarte.jsx, frontend/src/features/invite/InscriptionPage.jsx, backend/apps/noyau/vues_public.py, frontend/src/features/invites/PanneauInvite.jsx, frontend/src/lib/schemas.js, backend/apps/noyau/serializers.py, backend/apps/noyau/sondages.py, backend/apps/noyau/vues_scan.py, backend/apps/noyau/erreurs.py, backend/config/settings.py, backend/config/settings_test.py, backend/vercel.json, backend/requirements.txt, frontend/package.json, .github/workflows/ci.yml, README.md, PLAN.md]
---

# Risques, limitations et dette technique

Chaque entrée est une **observation vérifiée dans le code**, sauf mention « à confirmer ».

## R1 — Accès hôte de la borne non protégé (sécurité, moyen) — ✅ RÉSOLU le 2026-10-13
- **Constat** : sur la tablette borne (S11), le bouton cadenas « Espace hôte » appelle `outils.reglages`, qui
  ouvre directement `FeuilleReglages` — aucun code ni mot de passe. La feuille propose « Changer de cérémonie »
  et « Quitter le scan · tableau de bord » (`/admin/evenements/<id>`).
- **Conséquence** : un invité devant la borne peut atteindre l’espace admin avec la session de l’hôte connecté
  (liste des invités, emails, téléphones, exports).
- **Fichiers** : `frontend/src/features/scan/ScanPoste.jsx` (`DispositionBorne`, `outils.reglages`),
  `frontend/src/features/scan/composants.jsx` (`FeuilleReglages`).
- **Résolution** : mot de passe de l'hôte vérifié par le serveur, bouton retour bloqué, et surtout **session
  restreinte côté serveur** ([ADR-010](../decisions/ADR-010-mode-borne-serveur.md)) : même en tapant une adresse,
  le public n'obtient ni la liste des invités ni l'espace admin.

## R2 — Écran I7 « Cette adresse est déjà inscrite » inaccessible (dette, faible)
- **Constat** : `InscriptionView.post` intercepte `DEJA_INSCRIT` et renvoie la même réponse 201 qu’un succès
  (voir [ADR-005](../decisions/ADR-005-anti-enumeration-inscription.md)). Le frontend ne reçoit donc jamais ce
  code ; la branche `DEJA_INSCRIT` de `EtatCarte.jsx` n’est plus atteinte depuis le formulaire public.
- **Conséquence** : code mort ; `PLAN.md` (C8) et le README décrivent encore l’ancien comportement.
- **Statut** : ouvert (décider : supprimer la branche ou la conserver documentée). Revérifié le 2026-10-21 : inchangé
  (`vues_public.InscriptionView.post`, `EtatCarte.jsx` ; README « L’écran … est conservé (exigé) », `PLAN.md` I7 / C8).
  Revérifié le 2026-10-26 (`44eceb5`) : inchangé.

## R3 — Règle « tous les champs obligatoires » non appliquée à la modification (cohérence, faible)
- **Constat** : inscription et ajout manuel exigent entreprise et fonction (`ChampsProfessionnelsObligatoires`,
  `schemaInviteComplet`). La modification d’une fiche (`ModificationInviteSerializer`, `schemaInvite`) les
  accepte vides, et l’interface les libelle « facultatif » (`PanneauInvite.jsx`).
- **Statut** : ouvert — à confirmer si c’est voulu. Revérifié le 2026-10-21 : inchangé (`ModificationInviteSerializer`
  rend tous les champs facultatifs, libellés « Entreprise · facultatif » / « Fonction · facultatif »). Revérifié le
  2026-10-26 : inchangé.

## R4 — README en retard (documentation, faible)
- Annonce toujours « 79 tests » pytest (`README.md` §5) ; au 2026-10-21 le dépôt contient 200 fonctions `test_*`
  dans 17 fichiers, soit **242 tests collectés** (`pytest --collect-only`). Décrit encore l’écran I7 comme exigé.
- N’indique pas `CRON_SECRET` parmi les variables (lue par `backend/config/settings.py`, absente de `.env.example`).
- **Statut** : ouvert (le wiki ne modifie pas le README). Revérifié le 2026-10-26 : README toujours à « 79 tests »,
  I7 « conservé (exigé) », sans `CRON_SECRET` ; 266 tests exécutés au 2026-10-23.

## R5 — Tests backend dépendants de MySQL (outillage)
- `pytest` exige un MySQL joignable (`config/settings_test.py` ne redéfinit pas `DATABASES`). Sans Docker, aucun
  test backend ne s’exécute (constaté le 2026-10-13, de nouveau MySQL et Redis arrêtés le 2026-10-21). Pas de repli
  SQLite dans le dépôt (le passage SQLite du 2026-10-14 utilisait des réglages temporaires hors dépôt).
- **Atténuation** : la CI (`.github/workflows/ci.yml`) lance `pytest --create-db` sur un service MySQL 8 à chaque
  push sur `main` et chaque pull request. **Statut** : ouvert (localement).

## R6 — Environnement Vercel : temps de réponse du renvoi du QR (faible, test uniquement)
- Sans file d'attente, l'email est envoyé pendant la requête quand l'adresse est inscrite : le temps de réponse
  peut révéler l'inscription malgré le message identique. Sans incidence en production (envoi par Celery).
- Revérifié le 2026-10-21 : inchangé (`RenvoiQrView` appelle `emails.planifier`, Celery en mode eager sans Redis).

## R7 — Sondage sur Vercel : heure et durée d'exécution (faible, test uniquement) — 🟡 atténué le 2026-10-14
- **Constat d'origine** : un seul cron par jour, tous les emails du sondage envoyés pendant la requête du cron
  (coupure de la plateforme à 300 s).
- **Atténuation** (commits `bd4f807`, `be899ff`) : deux crons par jour dans `backend/vercel.json` (`?passage=8h` à
  8 h et `?passage=12h` à 12 h, chemins distincts pour que Vercel ne les fusionne pas) ; sans file,
  `sondages.planifier_sondages` enregistre d'abord tous les liens et emails « en attente », envoie pendant au plus
  `BUDGET_SANS_FILE_S` = 200 s, et le cron suivant reprend les emails restés en attente
  (`test_sans_file_envoi_dans_le_budget_puis_reprise`).
- **Reste** : au-delà de ce que deux passages de 200 s peuvent envoyer, des présents ne reçoivent rien le jour même
  (à confirmer en volume réel) ; ❓ imprécision horaire du cron sur le plan Hobby (jusqu'à une heure, d'après la
  documentation Vercel, non vérifiable dans le dépôt). Exige `CRON_SECRET` (≥ 32 caractères) sur `flex-checking-api`.
- En production, Celery Beat + worker : envoi à 8 h et rattrapages horaires jusqu'à 20 h, sans cette limite.

## R8 — Texte de consentement de l'inscription muet sur les emails (conformité, à trancher) — 🟡 atténué le 2026-10-22
- Le texte du consentement (`InscriptionPage.jsx`) ne mentionne ni l'email n°2 ni le sondage de satisfaction
  (email n°3, ajouté le 2026-10-14). Le texte a été validé par l'utilisateur le 2026-10-13 : **non modifié**,
  à confirmer avec MDE (mention du sondage, droit de ne pas répondre). Revérifié le 2026-10-21 : texte inchangé
  (« J’accepte la politique de confidentialité et les conditions d’utilisation du service »).
- **Atténuation** (commits `d91d426`, `7e0e071`) : « politique de confidentialité » est désormais un lien vers
  `/confidentialite` (`ConfidentialitePage.jsx`), qui annonce le magazine et le questionnaire du lendemain ; la
  mention « conformément au RGPD » est remplacée par « conformément à la loi ivoirienne n° 2013-450 sur la
  protection des données personnelles ». **Reste** : la case elle-même ne nomme toujours ni l'email n°2 ni le
  sondage (constaté le 2026-10-26) ; formalités ARTCI à vérifier par MDE. **Statut** : ouvert (atténué).

## R9 — Unicité « un avis par appareil » contournable (faible)
- Repose sur un cookie et un identifiant de navigateur (pas d'IP, voir ADR-012) : un appareil nettoyé peut
  répondre avec le lien d'un autre invité. Chaque lien ne sert qu'une fois. Revérifié le 2026-10-21
  (`sondages.repondre` : empreintes du cookie et de l'identifiant local).

## R10 — IP du client vue par le backend sur Vercel (à confirmer, test uniquement)
- Le frontend Vercel relaie `/api` vers un **autre** projet (`flex-checking-api`) : le backend voit peut-être l'IP du
  relais et non celle du client. Toutes les limites par IP seraient alors partagées entre tous les visiteurs
  (ex. 60 inscriptions/h au total). À vérifier en journalisant `get_ident()` sur l'environnement de test.
  Revérifié le 2026-10-21 : aucune lecture d'en-tête propre à Vercel dans le code ; seul `NUM_PROXIES` (défaut 1).
- Pistes : lire `x-vercel-forwarded-for` / `x-real-ip` si fiables, ou servir l'API depuis le même projet.

## R11 — Pas de CAPTCHA sur les formulaires publics (moyen)
- Inscription, renvoi du QR et sondage reposent sur des limites par IP (IPv6 regroupées par /64 depuis le
  2026-10-14). Un attaquant disposant de nombreuses IPv4 peut encore remplir la capacité d'une cérémonie avec de
  fausses inscriptions. Proposition : Cloudflare Turnstile (service externe, à valider par MDE). Revérifié le
  2026-10-21 : aucun CAPTCHA dans le code.

## R12 — Durcissements laissés en l'état (faible)
- Vérification du mot de passe de l'hôte à la borne : 5/min et 30/h ; un verrou plus long permettrait au public de
  bloquer l'hôte (déni de service) — compromis conservé.
- Outillage de développement : Tailwind CSS 3 dépend de `braces`, `micromatch` et `chokidar` signalés par `npm
  audit` (déni de service sur des motifs de fichiers, à la compilation seulement) ; correction = Tailwind 4 (refonte
  de la configuration) ; `tailwindcss` toujours en `^3.4.17` le 2026-10-21. Aucune vulnérabilité dans les
  dépendances livrées (`npm audit --omit=dev` : 0, constaté le 2026-10-14, non relancé depuis).
- `requirements.txt` sans hachages (`pip-compile --generate-hashes` proposé) ; `pip-audit` : Pillow passé en 13.0.0
  le 2026-10-22 à la suite d'un avis ; CI limitée à `permissions: contents: read`.
- HSTS `preload` non activé (engagement définitif du domaine, à décider par MDE).

## R13 — Passage « C'est moi » hors ligne pouvant bloquer la file (fiabilité, faible) — ✅ RÉSOLU le 2026-10-22
- **Constat d'origine** : rejoué après l'expiration de son jeton `choixBorne` (5 min), un « C'est moi » recevait 403
  `CHOIX_BORNE_INVALIDE` ; `fileHorsLigne.rejouer` s'arrêtait sur tout 403 sans retirer l'élément, bloquant les
  passages suivants jusqu'à la purge à 7 jours.
- **Résolution** : `fileHorsLigne.rejouer` retire l'élément sur le code `CHOIX_BORNE_INVALIDE` et continue ; les
  autres 403 (CSRF, droits retirés) gardent la file. Preuve : `frontend/tests/fileHorsLigne.test.js` (2 tests).
- **Complément (`7e0e071`)** : le jeton « C'est moi » (5 min) est jugé à l'heure du passage hors ligne
  (`vues_scan.choix_borne_valide`, rejeu jusqu'à 12 h) : un passage synchronisé tard n'est plus perdu. Preuve :
  `test_durcissement.py::test_c_est_moi_touche_hors_ligne_puis_synchronise`.

## R14 — Renvoi de l'email n°2 depuis la fiche sans contrôle de `magazine_actif` (cohérence, faible) — ✅ RÉSOLU le 2026-10-22
- **Constat d'origine** : `vues_invites.RenvoiEmailView` vérifiait Présent et `lien_magazine`, pas `magazine_actif`.
- **Résolution** : la vue s'appuie sur `suivi_emails.magazine_disponible` (même règle que le renvoi groupé de A7) et
  répond `MAGAZINE_INDISPONIBLE` si le magazine est désactivé. Preuve : `test_invites.py`
  (`test_renvoi_magazine_refuse_si_desactive`).

## R15 — Petits écarts d'affichage et d'en-têtes (faible)
- Renvoi groupé d'invitations : la réponse contient `ignores`, mais le frontend ne l'affiche pas (« renvoyée à 0
  invité » quand tous sont ignorés).
- Email n°3 : absent de la liste des invités (`serializers.invites_annotes` n'annote que n°1 et n°2) et de son
  export ; pas de bouton de renvoi depuis la fiche (API seulement). À confirmer si c'est voulu.
- `X-Frame-Options` : `DENY` côté Django, `SAMEORIGIN` dans `infra/Caddyfile.prod` (incohérent, sans risque).
  Revérifié le 2026-10-22 : inchangé ; « ignores non affiché » et « email n°3 hors liste » aussi. Revérifié le
  2026-10-26 : tous ces points inchangés (`vues_invites` renvoie `ignores`, aucun usage dans `frontend/src` ;
  `invites_annotes` : `email1`, `email2` seulement).
- `.env.example` ne mentionne pas `CRON_SECRET`, lu par `settings.py` (utile seulement sur Vercel).

## R16 — Sondage sur Vercel : présences validées tard (faible, test uniquement — à confirmer)
- Deux crons (8 h et 12 h) au lieu des passages horaires de Beat jusqu'à 20 h : un sondage non parti à 12 h attend
  le lendemain, alors que le lien n'est valable que 24 h. Complète R7.

## R17 — Exports lourds introuvables en production Docker (fonctionnel, moyen) — ✅ RÉSOLU le 2026-10-22
- **Constat d'origine (2026-10-21)** : un export de plus de 50 invités est écrit par Celery dans `/app/media/exports`
  (`taches.ecrire_fichier`) et lu par Django (`vues_invites.TacheFichierView`) ; sans volume commun, le
  téléchargement répondait 404 en production Docker.
- **Résolution** : `docker-compose.prod.yml` monte le volume `media-data:/app/media` dans l'ancre `x-backend`
  (django, celery, celery-beat). Le contournement manuel du guide
  [deploiement-infomaniak](../operations/deploiement-infomaniak.md) n'est plus nécessaire.

## R18 — Inscription publique automatisable (sécurité, moyen — décision MDE)
- Ni CAPTCHA ni confirmation de l'adresse email : seule la limite `LIMITE_INSCRIPTION_IP` (60/h par IP par défaut,
  `settings.py`) freine un remplissage automatisé de la capacité ou des inscriptions au nom de tiers. Voir R11
  (CAPTCHA proposé) ; R10 aggrave le cas sur Vercel. **Statut** : ouvert, à trancher par MDE.

## R19 — Borne : codes à 4 chiffres devinables (sécurité, moyen)
- Depuis le 2026-10-22, une session borne est limitée à `MAX_CODES_INVALIDES_BORNE` = 10 codes invalides par
  10 minutes (`vues_scan.EmargementView`, 30 hors borne). Avec quelques centaines d'invités sur 10 000 codes possibles,
  10 essais donnent encore de l'ordre de 25 % de chances d'émarger **un** invité au hasard par fenêtre (ordre de
  grandeur fourni par l'audit, à confirmer selon la capacité réelle).
- **Option** : désactiver le mode code en borne (QR seulement). **Statut** : ouvert, accepté en l'état.

## R20 — Écrasement silencieux « dernier qui écrit gagne » (cohérence, faible)
- Fiche invité, paramètres globaux, cérémonies et programmes : pas de verrou optimiste (ni version ni date de
  modification comparée) ; deux admins qui modifient en même temps perdent la première saisie sans avertissement.
  **Statut** : accepté (usage peu concurrent), à revoir si besoin.

## R21 — Migrations sans stratégie expand/contract (exploitation, moyen)
- Des colonnes NOT NULL sont ajoutées sans `db_default` et `0008_inscriptions_pas_dans_le_futur.py` supprime des
  données : un déploiement sans interruption (ancien et nouveau code en parallèle) n'est pas garanti.
- **Proposition** : adopter une convention (ajouter nullable ou avec `db_default`, migrer, puis contraindre ;
  sauvegarde avant toute migration destructive). **Statut** : ouvert. Constat du 2026-10-26 : les migrations
  récentes `0010_donnees_personnelles` et `0011_derniere_tentative` respectent déjà ce schéma (colonnes nullables ou
  avec `db_default`), appliquées sur Neon avant le déploiement du code le 2026-10-22 ; aucune convention écrite.

## R22 — Infrastructure Docker : images non épinglées, Redis sans mot de passe (faible)
- `docker-compose.prod.yml` référence `mysql:8.0`, `redis:7-alpine`, `caddy:2-alpine` par étiquette, sans empreinte
  (`@sha256:…`) : une reconstruction peut changer d'image. Redis n'a pas de mot de passe (pas de `requirepass`),
  accepté car il n'est joignable que sur le réseau interne Docker (aucun port publié). **Statut** : accepté.
- Revérifié le 2026-10-26 : toujours aucune empreinte (`python:3.12-slim` dans `backend/Dockerfile`, `mysql:8.0`,
  `redis:7-alpine`, `caddy:2-alpine`, `node:24-alpine`). Choix inverse assumé pour Node.js (modifications non
  commitées du 2026-10-23) : étiquette flottante re-téléchargée (`pull_policy: always`, `--pull always`) avec une
  version minimale imposée par `frontend/package.json` (`engines`) ; le guide recommande `docker compose build
  --pull` pour les autres images.

## R23 — Un avis par appareil : deux invités sur un même téléphone (fonctionnel, faible — choix ADR-012)
- L'unicité du sondage par appareil (cookie + identifiant local, `sondages.repondre`) refuse le second invité qui
  répond depuis le même téléphone. Choix assumé de [ADR-012](../decisions/ADR-012-sondage-satisfaction.md) ;
  complète R9.
- Corollaire (`7e0e071`, `suivi_emails.renvoyer_echecs` et renvoi individuel) : pour ne pas révéler qui a répondu,
  un renvoi du n°3 traite de la même façon tous les liens encore ouverts ; un invité qui a déjà répondu peut donc
  recevoir de nouveau son lien (il ne peut pas répondre une seconde fois). Accepté pour l'anonymat.

## R24 — Journaux du serveur de développement : recherche en clair (confidentialité, faible)
- `runserver` (développement, `docker-compose.yml`) journalise l'URL complète, dont `?q=` (souvent un email). En
  production, `backend/gunicorn.conf.py` applique `MasquerParametresUrl` / `MasquerDonneesPersonnelles`
  aux journaux d'accès. **Statut** : accepté (poste de développement).

Rappel : le temps de réponse du renvoi du QR sur Vercel (R6) est inchangé au 2026-10-22.

Revérifiés le 2026-10-26 sur `44eceb5`, sans changement : R5, R6, R7, R9, R10, R11, R12 (Tailwind `^3.4.17`,
Pillow 13.0.0), R16, R18, R19 (`MAX_CODES_INVALIDES_BORNE` = 10), R20, R23, R24.

## Limitations assumées (documentées, non bugs)
- Durée de conservation des données : la confirmation avant de la **raccourcir** n'existe que dans l'interface
  (`Parametres.jsx`, dialogue « Raccourcir la durée de conservation ? ») ; l'API (`vues_admin`, paramètres globaux)
  applique la nouvelle valeur sans confirmation, avec journalisation (`journal_texte` : « Durée de conservation des
  données : N mois ») ; l'anonymisation de la nuit suivante est irréversible (constaté le 2026-10-26).
- Statistiques et analyses calculées en Python sur toutes les lignes d’une cérémonie : adapté à quelques
  centaines d’invités, à surveiller au-delà (`statistiques.py`, `analytique.py`). Mis en cache 30 s et invalidé.
- Environnement Vercel : pas de temps réel, emails en une seule tentative, emails écrits dans les journaux
  (voir [ADR-007](../decisions/ADR-007-environnement-test-vercel.md)).
- Hors ligne au scan : aucune validation locale ; tout passage est « en attente » jusqu’à la synchronisation
  (voir [hors-ligne](../features/hors-ligne.md)).
- Recherche par nom indisponible hors ligne.
- Erreurs techniques : 5 000 signatures max (2 000 pour le navigateur), conservation 30 jours.
