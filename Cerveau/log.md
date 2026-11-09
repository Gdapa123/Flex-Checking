---
type: log
---

# Journal du wiki et du développement

Ajout seul, la plus récente en bas. Format décrit dans [CLAUDE.md](CLAUDE.md) §10.
Historique antérieur au wiki : voir `git log` (14 commits du 2026-10-09 au 2026-10-12) et [roadmap](project/roadmap.md).

## [2026-10-13] documentation | Initialisation du wiki « cerveau »

- **Contexte :** mise en place d’un wiki maintenu par l’agent (modèle « LLM Wiki ») pour conserver une
  compréhension durable du projet entre les sessions, dans le coffre Obsidian `Cerveau/`.
- **Modifications :** audit complet du dépôt (code backend et frontend, configuration, CI, déploiements) ;
  création du schéma `Cerveau/CLAUDE.md`, de l’index, de ce journal et de 39 pages (projet, architecture,
  11 fonctionnalités, spécifications, API, 9 décisions, tests, exploitation, 4 gabarits) ; `CLAUDE.md` à la racine
  du dépôt qui importe `Cerveau/CLAUDE.md`. Aucun code applicatif modifié.
- **Fichiers concernés :** `CLAUDE.md`, `Cerveau/**/*.md` (hors `.obsidian/` et `Bienvenue.md`, inchangés).
- **Validation :** `npm test` 42/42 ✅ ; `npm run lint` ✅ ; `npm run build` ✅ ; `ruff check` et
  `ruff format --check` ✅ ; `pytest` ⛔ non exécuté (MySQL injoignable, Docker arrêté) ; e2e non lancés ;
  vérification des liens internes du wiki (script de `CLAUDE.md` §4).
- **Décision :** wiki dans `Cerveau/` plutôt que `docs/` (demande explicite) ; ADR-005 constate que PLAN C8 a été remplacé.
- **Risques ou limites :** R1 (accès hôte de la borne), R2 (écran I7 inaccessible), R3 (règle de modification),
  R4 (README en retard), R5 (tests backend dépendants de MySQL) — voir [risques-et-dette](project/risques-et-dette.md).
  Suivi Git de `Cerveau/` non décidé ; `Cerveau/.obsidian/workspace.json` change à chaque ouverture d’Obsidian.

## [2026-10-13] documentation | Commandes du wiki et contrôle automatique

- **Contexte :** demande d’ajouter les commandes d’exploitation du wiki (ingestion, contrôle de santé, etc.).
- **Modifications :** cinq commandes Claude Code (skills du projet) : `/wiki-ingest`, `/wiki-maj`, `/wiki-question`,
  `/wiki-lint`, `/wiki-journal` ; script `Cerveau/outils/lint_wiki.py` (liens, frontmatter, sources, index,
  orphelines, pages périmées par rapport à git) ; schéma §2, §4 et §8 et index mis à jour ; dossiers `sources/`,
  `resumes/`, `analyses/` prévus (créés à la première utilisation).
- **Fichiers concernés :** `.claude/skills/wiki-ingest/SKILL.md`, `.claude/skills/wiki-maj/SKILL.md`,
  `.claude/skills/wiki-question/SKILL.md`, `.claude/skills/wiki-lint/SKILL.md`, `.claude/skills/wiki-journal/SKILL.md`,
  `Cerveau/outils/lint_wiki.py`, `Cerveau/CLAUDE.md`, `Cerveau/index.md`, `Cerveau/log.md`.
- **Validation :** `python3 Cerveau/outils/lint_wiki.py` → 0 erreur, 0 page à revérifier, 0 avertissement ; détection
  des pages périmées testée en remplaçant temporairement le commit d’une page par `3758720` (5 commits signalés),
  puis page restaurée.
- **Risques ou limites :** les commandes n’apparaissent qu’après redémarrage de la session Claude Code si
  elles ne sont pas détectées à chaud.

## [2026-10-13] correction | Erreurs « Rejected » des scripts injectés ignorées par le signalement

- **Contexte :** erreur technique « Error · Rejected », source Navigateur, page `/i/pmd-2026-387a21/`, dernière
  occurrence le 12/10/2026 à 17:04.
- **Modifications :** diagnostic : « Rejected » n’apparaît ni dans `frontend/src`, ni dans `frontend/dist`, ni dans
  `node_modules` → erreur levée par un script tiers (extension, navigateur intégré d’une application) et capturée par
  `unhandledrejection`. Ajout de `vientDeLApplication(erreur, fichier)` : seules les erreurs dont le fichier ou la
  trace contient l’origine de l’application sont signalées (événements `error` et `unhandledrejection`) ; les erreurs
  d’affichage React (`FiletErreur`) restent toujours signalées.
- **Fichiers concernés :** `frontend/src/lib/signalement.js`, `frontend/tests/signalement.test.js`,
  `Cerveau/features/erreurs-techniques.md`, `Cerveau/testing/test-strategy.md`.
- **Validation :** `npm test` 43/43 ✅ ; `npm run lint` ✅ ; `npm run build` ✅. Pas de test e2e lancé.
- **Risques ou limites :** cause déduite par élimination (le détail technique de l’erreur — trace, navigateur — n’a
  pas pu être consulté : base non accessible depuis ce poste). Une erreur de l’application sans trace (cas très rare)
  ne serait plus signalée. Non commité, non déployé.

## [2026-10-13] fonctionnalité | Abréviations PAMP / PASD et graphique des arrivées repensé

- **Contexte :** les abréviations de Public-AMP et Public-ASD doivent être PAMP et PASD (affichées « PAM » / « PAS ») ;
  le graphique « Arrivées par tranche de 15 minutes » apparaissait vide et peu explicite : barres hors tranche
  courante en teinte très pâle (`--ps`), courbe du cumul en couleur secondaire (jaune pour PMD, quasi invisible sur
  blanc), aucun axe des valeurs, aucun message quand il n’y a pas d’arrivée.
- **Modifications :** `monogramme` : initiales des premiers mots + dernier mot entier, 4 lettres max (police réduite
  à 4 lettres). Nouveau composant `ArriveesParTranche` : titre « Arrivées à l’accueil » et explication, résumé chiffré,
  barres en couleur principale avec valeurs, axe Y et quadrillage, repère de lancement, bande « En cours », info-bulle,
  légende, état vide explicite ; courbe du cumul retirée (le cumul est dans l’info-bulle). Pas de changement d’API.
- **Fichiers concernés :** `frontend/src/features/admin/ChoixCeremonie.jsx`, `frontend/src/features/admin/TableauDeBord.jsx`,
  `frontend/tests/tableauDeBord.test.jsx` (nouveau), `Cerveau/features/tableau-de-bord.md`, `Cerveau/testing/*`.
- **Validation :** `npm test` 47/47 ✅ ; `npm run lint` ✅ ; `npm run build` ✅. **Rendu visuel non vérifié dans un
  navigateur** (backend indisponible : Docker arrêté).
- **Risques ou limites :** le rapport PDF (`rapports.py`) garde son propre graphique des arrivées, inchangé. Non commité,
  non déployé.

## [2026-10-13] fonctionnalité | Revue UI/UX complète du frontend : corrections et modernisation

- **Contexte :** demande de revue de tout le frontend (skill ui-ux-pro-max), plus moderne et professionnel, sans
  changer l’identité. Revue faite sur 24 captures réelles (ordinateur 1440 px et mobile 390 px) d’une instance locale
  (SQLite + données de démo, réglages temporaires hors dépôt). La palette générique proposée par le skill n’a pas été
  retenue (identité existante conservée).
- **Corrections :** indicateur temps réel bloqué sur « Reconnexion… » sans Redis → nouvel état `indisponible`
  (« Actualisation auto ») ; info-bulles Recharts « : 0 inscriptions » (séparateur vide, pluriel) ; taux de présence
  par année faussé par les cérémonies à venir ou en cours (serveur : terminées seulement, test ajouté) ; actions des
  comptes admins hors écran → boutons icônes ; Vue globale : colonne cérémonie écrasée, barre de remplissage minuscule,
  « 0 mot(s) de passe temporaire(s) » ; mobile : heures de l’axe superposées, indicateurs sur une colonne, bouton de
  déconnexion isolé ; placeholder de recherche tronqué ; copie du mot de passe temporaire sans gestion d’erreur.
- **Modernisation :** transitions et retour tactile homogènes, listes déroulantes stylées (flèche du design), titres
  équilibrés, couleur de sélection, voile flouté et blocage du défilement sous les dialogues (`useVerrouDefilement`),
  bouton « Afficher le mot de passe » (`Champ`), lien d’évitement « Aller au contenu » (`LienEvitement`), survol des
  listes cliquables sans décalage, page de connexion avec fond texturé discret.
- **Fichiers concernés :** `frontend/src/styles/index.css`, `frontend/src/styles/tokens.css`,
  `frontend/src/components/ui/{Champ,Dialogue,PanneauLateral,icones,LienEvitement,useVerrouDefilement}`,
  `frontend/src/lib/tempsReel.js`, `frontend/src/features/admin/{EspaceEvenement,TableauDeBord,ChoixCeremonie}.jsx`,
  `frontend/src/features/auth/ConnexionAdmin.jsx`, `frontend/src/features/invites/GestionInvites.jsx`,
  `frontend/src/features/super/{Analyses,Comptes,Evenements,Programmes,SuperApp,VueGlobale}.jsx`,
  `frontend/tests/tempsReel.test.js`, `backend/apps/noyau/analytique.py`, `backend/apps/noyau/tests/test_analytique.py`.
- **Validation :** `npm test` 48/48 ✅ ; `npm run lint` ✅ ; `npm run build` ✅ ; `ruff check` / `ruff format --check` ✅ ;
  pytest sur SQLite 184/185 (échec attendu du test de concurrence, propre à SQLite) ; pytest sur MySQL et e2e non
  lancés (Docker arrêté) ; captures avant / après comparées.
- **Risques ou limites :** écrans de scan (caméra) et emails non revus visuellement en conditions réelles ; R1 (accès
  hôte de la borne) toujours ouvert. Non commité, non déployé.

## [2026-10-13] correction | Code-review des changements en cours : 10 constats corrigés

- **Contexte :** `/code-review high` sur le travail non commité (graphique des arrivées, revue UI, signalement).
- **Modifications :** signalement : n'écarte une erreur que sur preuve d'origine étrangère, et seuls les scripts du
  bundle (`/assets/`, `/src/`) comptent comme application ; taux par programme et taux global sur cérémonies
  terminées ; tranche « en cours » calculée par le serveur (`trancheEnCours`, remplace `trancheCourante` inutilisé)
  et statistiques rechargées chaque minute le jour J ; message dédié aux présences enregistrées hors du jour ;
  temps réel indisponible signalé par le code 4004 du serveur (plus de déduction après deux échecs) ; primitive
  unique `BoutonIcone` ; coche de validité décalée sur un champ mot de passe ; tests e2e : libellé exact du champ.
- **Validation :** voir l'entrée suivante.

## [2026-10-13] sécurité | Audit de sécurité complet et corrections

- **Contexte :** demande « corrige les failles de sécurité » ; audit en lecture seule de tout le code (agent dédié),
  constats vérifiés dans le code avant correction.
- **Modifications :**
  1. (élevé) emails **ASCII uniquement** : la collation `utf8mb4_unicode_ci` confondait « mdé.ci » et « mde.ci »,
     contournant toutes les limites de connexion et de renvoi ; limite de connexion par IP (30/min) ;
  2. (moyen) verrouillage à distance : seuls les **échecs** de connexion comptent par compte ;
  3. (moyen) **borne : session restreinte côté serveur** (claim `borne`, `autorise_borne`, recherche réduite,
     élévation par le mot de passe de l'hôte, bouton retour bloqué) — [ADR-010](decisions/ADR-010-mode-borne-serveur.md),
     résout R1 ;
  4. (faible) CSRF exigé sur connexion et déconnexion, API en JSON uniquement (plus de multipart) ;
  5. (faible) jeton d'accès révoqué à la déconnexion (API et WebSocket) ;
  6. (faible) renvois d'email par un admin : 5/h par compte et par invité ;
  7. (faible) compteur de codes invalides incrémenté de façon atomique avant l'émargement ;
  8. (faible, Vercel) limites par IP des points d'accès publics partagées entre instances (`LimiteIpPartagee`) ;
  9. (faible, dev) MySQL et Redis du compose de développement liés à 127.0.0.1.
- **Fichiers concernés :** `backend/apps/comptes/{authentication,permissions,throttles,views}.py`,
  `backend/apps/noyau/{vues_scan,vues_invites,vues_admin,vues_public,vues_erreurs,validation,consumers,analytique,statistiques,urls}.py`,
  `backend/config/settings.py`, `backend/apps/noyau/tests/{test_audit_securite,test_securite,test_analytique,test_invites,test_temps_reel,conftest}.py`,
  `docker-compose.yml`, `frontend/src/features/scan/{ScanPoste,ScanSetup,composants}.jsx`,
  `frontend/src/features/auth/RequireRole.jsx`, `frontend/src/components/ui/BoutonIcone.jsx`, `frontend/src/lib/{signalement,tempsReel}.js`,
  `frontend/e2e/*.spec.js`.
- **Validation :** pytest (SQLite, réglages temporaires) 202/203 — seul échec : test de concurrence non exécutable sur
  SQLite ; `ruff` ✅ ; `npm test` 50/50 ✅ ; lint ✅ ; build ✅ ; e2e 3/3 ✅ (SQLite + relais en mémoire) ; parcours
  borne en navigateur 14/14 ✅. **pytest sur MySQL non exécuté** (Docker arrêté) : à lancer avant déploiement,
  notamment pour le test de concurrence et la collation.
- **Risques ou limites :** R6 (temps de réponse du renvoi sur Vercel) ; borne hors ligne : pas de passage en mode
  restreint ; un invité peut émarger quelqu'un d'autre sur la borne. Nouvelle variable optionnelle
  `LIMITE_CONNEXION_IP`. Non commité, non déployé.

## [2026-10-13] fonctionnalité | Zones de visée du scan agrandies

- **Contexte :** zones de lecture des QR codes jugées trop petites.
- **Modifications :** `CadreVisee` accepte une taille CSS adaptative, des coins proportionnels (22 %) et un voile qui
  assombrit la vidéo autour du cadre ; téléphone `min(82vw, 50dvh, 440px)` (cadre et message dans une même colonne),
  borne `min(38vw, 56dvh, 560px)`, ordinateur `min(30vw, 44dvh, 380px)` dans une vidéo plus haute ; jeton
  `--g-voile-visee`.
- **Fichiers concernés :** `frontend/src/features/scan/composants.jsx`, `frontend/src/features/scan/ScanPoste.jsx`,
  `frontend/src/styles/tokens.css`, `Cerveau/features/scan-emargement.md`.
- **Validation :** captures avec caméra simulée sur 360×640, 390×844, borne 1180×820 et ordinateur 1440×900 ;
  `npm test` 50/50 ✅, lint ✅, build ✅.
- **Risques ou limites :** non vérifié sur un appareil physique. Non commité, non déployé.

## [2026-10-13] sécurité | 2e code-review : 9 constats corrigés, 1 compromis assumé

- **Contexte :** `/code-review high` sur l'ensemble des changements non commités (48 fichiers).
- **Modifications :**
  - borne : la session redevient restreinte dès que l'hôte quitte son espace, quelle que soit la feuille (avant :
    seulement à la fermeture des réglages ; passer par l'annulation laissait une session complète) ;
  - recherche de la borne : 3 caractères par mot (« a e » listait tout), limite 30/min par compte ;
  - connexion : compteur d'échecs incrémenté avant la vérification (atomique), remis à zéro par une réussite ;
  - cache en base (sans Redis) : `incr`/`decr` ne raccourcissent plus la fenêtre de comptage à 300 s ;
  - configuration du scan : en session borne, un autre type de poste exige le mot de passe ; un refus du serveur au
    passage en mode borne bloque le démarrage (seule une coupure réseau est tolérée) ;
  - règle « email ASCII » ajoutée au schéma Zod (règle des deux côtés) ;
  - temps réel indisponible : pas de reconnexion anticipée au retour du réseau ou de l'onglet ;
  - taux par programme calculé dans une seule boucle.
- **Non retenu :** vérifier le jeton d'accès révoqué ailleurs qu'à chaque requête. Le coût est un appel Redis
  (moins d'une milliseconde) ; le retirer redonnerait 15 min de validité à un jeton volé après déconnexion.
- **Validation :** pytest (SQLite) 203/204 (seul échec : test de concurrence non exécutable sur SQLite) ; `npm test`
  52/52 ; lint ✅ ; build ✅ ; e2e 3/3 ✅ ; parcours borne en navigateur 18/18 ✅. pytest sur MySQL non exécuté.
- **Risques ou limites :** non commité, non déployé.

## [2026-10-14] opérations | Commit, push et déploiement de l'environnement de test Vercel

- **Contexte :** demande « commit, push and deploy ».
- **Modifications :** commit `ffa45e4` poussé sur `origin/main` (avec 3 commits encore non poussés) ; CI GitHub verte
  sur ce commit (ruff + **pytest sur MySQL**, lint, Vitest, build, Playwright). Frontend `flex-checking` déployé
  automatiquement par l'intégration Git de Vercel au push (13/10 15:12) ; backend `flex-checking-api` déployé par la
  CLI le 14/10 (`vercel deploy --prod --scope mde-it`). Aucune migration de base nécessaire.
- **Validation :** `/api/sante/` ok ; nouvelles routes `auth/borne/` et `auth/verifier-mot-de-passe/` présentes (401
  sans session) ; connexion sans CSRF refusée (403) ; nouvelles fonctions présentes dans les fichiers du frontend en
  ligne ; relais `/api` du frontend ok.
- **Risques ou limites :** entre les deux déploiements (≈ 15 h), le nouveau frontend parlait à l'ancien backend
  (démarrage d'une borne refusé, `auth/borne/` absent) ; résolu par le déploiement du backend. Production
  (`docker-compose.prod.yml`) non concernée.

## [2026-10-14] maj | Lisibilité du libellé des aperçus d'emails (A7)
- **Contexte :** retour utilisateur : le texte « Email n°1 · à l'inscription · statut « Inscrit » » est peu visible.
- **Modifications :** `frontend/src/features/admin/ApercuEmails.jsx` : le libellé (11 px, gris `texte-2`, capitales)
  devient une pastille « Email n°X » couleur programme (texte blanc) suivie du moment d'envoi en 13 px gras,
  couleur `texte-3`. Titres de l'iframe et `aria-label` inchangés sur le fond.
- **Validation :** ESLint ok, Vitest 52/52, build ok. Pas de capture d'écran faite.
- **Risques ou limites :** aucun.

## [2026-10-14] deploy | Libellé des aperçus d'emails
- **Contexte :** demande « commit, push and deploy ».
- **Modifications :** commit `2e31006` poussé sur `origin/main` ; frontend `flex-checking` redéployé automatiquement
  par Vercel au push. Backend non concerné.
- **Validation :** CI GitHub verte sur `2e31006` ; déploiement Vercel « Ready » ; nouveau texte présent dans
  `AdminApp-*.js` en ligne.
- **Risques ou limites :** aucun.

## [2026-10-14] maj | Pas d'inscription datée dans le futur
- **Contexte :** retour utilisateur : les données de démonstration contenaient des invités inscrits à une date pas
  encore arrivée ; l'utilisateur ne veut pas que ce soit possible.
- **Cause :** `seed_demo` datait l'inscription « date de l'événement − 8 à 40 jours » : pour PMD (J+49) et
  Public-AMP (J+57), cela donnait des dates futures. Le formulaire et l'ajout manuel datent déjà à l'heure du serveur.
- **Modifications :** `seed_demo.py` (inscriptions d'une cérémonie à venir réparties sur les 30 derniers jours) ;
  `Invite.save()` refuse `inscrit_le` / `consentement_le` futurs ; migration `0008_inscriptions_pas_dans_le_futur`
  (recale, par événement, les inscriptions et emails d'invitation futurs en conservant leur étalement ; sans effet
  sur des données réelles) ; tests `test_dates_inscription.py` (3). Pages : `architecture/data-model.md`,
  `operations/setup.md`, `testing/test-strategy.md`.
- **Validation :** pytest SQLite 206/207 (échec connu propre à SQLite) ; le test du générateur échoue sans la
  correction ; ruff ok ; `makemigrations --check` sans changement ; migration appliquée à une base de démo locale :
  46 inscriptions futures (40 PMD, 6 Public-AMP) → 0, autres cérémonies inchangées.
- **Risques ou limites :** garde-fou applicatif uniquement (pas de `CHECK` en base) ; `bulk_create` le contourne.

## [2026-10-14] maj | CI : actions GitHub sur Node.js 24
- **Contexte :** avertissements de la CI : `actions/checkout@v4`, `setup-node@v4` et `setup-python@v5` sont conçues
  pour Node.js 20 (obsolète) et forcées sur Node.js 24.
- **Modifications :** `.github/workflows/ci.yml` : `checkout`, `setup-python`, `setup-node` et `upload-artifact` en
  v7 (`using: node24` vérifié dans leur `action.yml`) ; Node.js de la CI 20 → 24 (Node 20 en fin de vie, 24 = défaut
  Vercel). Page : `testing/test-strategy.md`.
- **Validation :** non exécutée : la CI ne peut être vérifiée qu'après un push.
- **Risques ou limites :** saut de 3 versions majeures pour les actions (options utilisées : `cache`,
  `cache-dependency-path`, `name`, `path`, toutes conservées) ; à confirmer par le prochain passage de la CI.

## [2026-10-14] maj | Suppression des invités inscrits dans le futur
- **Contexte :** demande « supprime les invités qui ont une date d'inscription futur » (au lieu de recaler leurs dates).
- **Modifications :** migration `0008_inscriptions_pas_dans_le_futur` réécrite avant toute application sur une base
  durable (le déploiement Vercel ne migre pas) : elle **supprime** les invités dont `inscrit_le` est dans le futur ;
  emails et émargements partent en cascade ; aucune entrée au journal d'audit. Test adapté
  (`test_migration_supprime_les_inscriptions_futures`). Page : `architecture/data-model.md`.
- **Validation :** ruff ok ; pytest SQLite 206/207 (échec connu propre à SQLite) ; copie de la base e2e locale :
  1 216 → 1 170 invités, 46 inscriptions futures → 0, aucun email orphelin.
- **Risques ou limites :** suppression définitive. Pas encore appliquée sur Neon (environnement Vercel) : nécessite
  commit, push, déploiement du backend puis `migrate` avec les variables de production.

## [2026-10-14] maj | Refonte de l'écran Emails (A7)
- **Contexte :** retour utilisateur avec capture : les libellés noir et gris au-dessus des aperçus sont illisibles sur
  le vert, et le design de la page ne plaît pas.
- **Cause :** le contenu des pages de l'espace événement remonte de 48 px sur l'en-tête dégradé (`-mt-12`, prévu pour
  des cartes) ; sur A7, les libellés n'étaient pas dans une carte et tombaient sur le dégradé.
- **Modifications :** `ApercuEmails.jsx` réécrit : une carte blanche par email (icône couleur programme, nom
  « Invitation » / « Magazine », numéro, moment d'envoi, badge du statut, bloc « Objet »), aperçu encadré de 640 px ;
  grille en deux colonnes à partir de 1 240 px ; magazine désactivé = carte avec message. Page : `features/emails.md`.
- **Validation :** ESLint ok, Vitest 52/52, build ok ; captures locales 1 440 px et 390 px (PMD avec magazine,
  Public-AMP sans magazine) vérifiées à l'œil.
- **Risques ou limites :** aucun.

## [2026-10-14] deploy | CI Node.js 24, migration 0008, refonte A7
- **Contexte :** demande « commit, push and deploy ».
- **Modifications :** commits `331ed98` (CI), `7db922b` (migration 0008 = suppression), `3718947` (A7) poussés ;
  frontend redéployé automatiquement au push ; backend `flex-checking-api` redéployé par la CLI (`--scope mde-it`).
- **Validation :** CI verte sur `3718947` (backend, frontend, Playwright), **aucune annotation** (avertissements
  Node.js 20 disparus) ; `/api/sante/` ok ; nouveau texte d'A7 présent dans `AdminApp-*.js` en ligne.
- **Risques ou limites :** migration `0008` **non appliquée** sur Neon : l'accès aux variables de production
  (`vercel env pull`) a été refusé par le contrôle de sécurité de Claude Code ; à lancer par l'utilisateur. Tant
  qu'elle ne l'est pas, les invités inscrits dans le futur restent visibles sur l'environnement Vercel.

## [2026-10-14] maj | A7 devient « Suivi des emails »
- **Contexte :** l'utilisateur demande à quoi sert l'écran Emails (aperçu en lecture seule), puis « transforme cette
  partie en fonctionnalité utile ou supprime la ».
- **Modifications :** backend : `apps/noyau/suivi_emails.py` (suivi, renvoi groupé des échecs, email de test),
  routes `suivi-emails/`, `suivi-emails/renvoyer-echecs/`, `suivi-emails/test/` sur `EvenementViewSet` (lecture
  admin, contrôle d'accès par `get_object`), limites `email_test` et `relance_emails` (10/h), action de journal
  `EMAIL_TEST`, `emails.message_depuis_rendu` extrait de `construire_message`. Frontend : `SuiviEmails.jsx` remplace
  `ApercuEmails.jsx` (supprimé), titre « Suivi des emails ». Tests : `test_suivi_emails.py` (9),
  `suiviEmails.test.jsx` (4). Pages : `features/tableau-de-bord.md`, `features/emails.md`, `api/endpoints.md`,
  `architecture/components.md`, `specifications/non-functional-requirements.md`, `testing/test-strategy.md`.
- **Validation :** ruff ok ; pytest SQLite 215/216 (échec connu propre à SQLite) ; `makemigrations --check` sans
  changement ; ESLint + Prettier ok ; Vitest 56/56 ; build ok ; parcours local dans Chromium (1 440 et 390 px) :
  compteurs, 3 échecs PMD listés, dialogue de renvoi, email de test envoyé (toast), aperçu déplié, PAMP sans magazine.
- **Risques ou limites :** l'email de test est envoyé de façon synchrone (quelques secondes si le SMTP est lent) ;
  sur Vercel, il dépend de la configuration SMTP de l'environnement. Le renvoi groupé repart vers la même adresse :
  une adresse erronée doit d'abord être corrigée dans la fiche.

## [2026-10-14] maj | Annulation réservée au super admin, configuration du scan revue
- **Contexte :** « l'admin ne doit pas avoir la possibilité d'annuler un émargement, seul le super admin » ; question
  sur l'utilité de plusieurs bornes ; « améliore l'interface de scan /ui-styling ».
- **Modifications :**
  - Annulation : `AnnulationView` et `AnnulerPresenceView` en `EstSuperAdmin` ; commandes masquées aux admins
    (`ScanPoste.jsx` outils filtrés, barre du téléphone en 4 colonnes ; `composants.jsx` bouton des réglages ;
    `BoutonPresence` ne rend rien pour un présent si le compte n'est pas super admin). ADR-011 (acceptée).
  - Postes : plusieurs postes conservés (files parallèles au pic, entrées distinctes ; « Arrivées par poste »).
    Suggestions « Borne 1 / Borne 2 / Poste ordinateur » remplacées par « Accueil 2 / Accueil 3 » (confusion avec la
    disposition « Borne ») ; `seed_demo` aligné.
  - S1 : quatre étapes numérotées (Cérémonie, Mode de lecture, Écran, Nom du poste), cartes avec icône et aide
    (`MODES_SCAN.aide`, `APPAREILS.icone/aide`), plus de débordement du sélecteur d'écran à 390 px, note quand la
    douchette impose l'ordinateur, aide expliquant le nom du poste.
  - S12 ordinateur : le panneau de résultat ne déborde plus (compte à rebours dans le panneau, taille du nom
    adaptative, `flex-none`), caméra à hauteur fixe ; panneau focalisable au clavier (`role="button"`).
  - Pages : `features/scan-emargement.md`, `features/gestion-invites.md`, `api/endpoints.md`,
    `specifications/functional-requirements.md`, `testing/test-strategy.md`, `index.md`.
- **Validation :** pytest SQLite 216/217 (échec connu propre à SQLite), dont `test_annulation_reservee_au_super_admin` ;
  ruff ok ; ESLint + Prettier ok ; Vitest 56/56 ; build ok ; e2e 3/3 sur une base SQLite neuve ; parcours de la
  borne 18/18 avec le compte super admin ; captures téléphone / borne / ordinateur en admin (sans « Annuler ») et en
  super admin (avec « Annuler »).
- **Risques ou limites :** le parcours de la borne avec un compte admin n'a plus de feuille d'annulation à ouvrir
  (non rejoué en admin).

## [2026-10-14] maj | Sondage de satisfaction (email n°3)
- **Contexte :** demande : sondage envoyé aux présents le lendemain vers 8 h, lien valable 24 h, au-delà une
  fenêtre « temps du sondage passé » avec remerciements, analyses pour admins et super admin, une réponse par
  email et par appareil ; tenir compte des implications et de l'orchestration.
- **Modifications :**
  - Données : `Programme.sondage_actif`, `Parametres.objet/corps_email_3`, `TypeEmail.SONDAGE`, modèles
    `InvitationSondage` et `ReponseSondage` (migration `0009_sondage_satisfaction`).
  - Métier : `apps/noyau/sondages.py` (planification idempotente à partir de 8 h, état, résultats, NPS, cumul,
    réponse avec contrôle expiré / déjà répondu / appareil) ; `emails.rendre` généralisé (gabarits
    `sondage.html/.txt`, variable `{lien_sondage}`) ; suivi A7, renvoi groupé et individuel limités aux liens
    ouverts ; section « Satisfaction » du rapport PDF ; sujet temps réel `sondage`.
  - Orchestration : tâche Celery `envoyer_sondages` (Beat `crontab(minute=0, hour="8-20")`) ; cron Vercel
    `0 8 * * *` → `GET /api/taches-planifiees/sondages/` protégé par `CRON_SECRET` ; limite `sondage` 60/h par IP.
  - Frontend : page publique `/sondage/:jeton` (`SondagePage.jsx` : étoiles, échelle 0-10, commentaire, fenêtre
    modale « clos », remerciements), carte A3 `CarteSatisfaction.jsx`, onglet Analyses › Satisfaction, onglet
    Paramètres « Email n°3 », interrupteur dans Programmes, 3e carte du suivi des emails, icônes étoile, cœur,
    message, sablier ; `LienInvalide` paramétrable.
  - Démo : sondage passé sur AMP et PMD 2025. Pages : `features/sondage-satisfaction.md` (nouvelle),
    `decisions/ADR-012-sondage-satisfaction.md` (nouvelle), `features/emails.md`, `api/endpoints.md`,
    `architecture/data-model.md`, `operations/deployment.md`, `operations/setup.md`,
    `specifications/non-functional-requirements.md`, `project/risques-et-dette.md` (R7–R9),
    `testing/test-strategy.md`, `index.md`.
- **Validation :** pytest SQLite 232/233 (échec connu propre à SQLite), dont `test_sondage.py` (16) ; ruff ok ;
  `makemigrations --check` sans changement ; ESLint + Prettier ok ; Vitest 63/63 (dont `sondage.test.jsx`, 6) ;
  build ok ; e2e 3/3 sur une base neuve (démo semée deux fois : idempotente) ; parcours manuel dans Chromium :
  envoi réel de 36 sondages sur AMP 2026 (cérémonie de la veille), formulaire, remerciement, fenêtre « clos »
  (mobile et ordinateur), carte A3, Analyses › Satisfaction, suivi A7, Paramètres onglet 3.
- **Risques ou limites :** R7 (cron Vercel Hobby : une fois par jour entre 8 h et 8 h 59, envois dans la requête,
  `CRON_SECRET` à créer), R8 (texte de consentement muet sur les emails, à trancher), R9 (unicité par appareil
  contournable). Page du sondage non couverte par le test d'accessibilité axe-core (e2e).

## [2026-10-14] securite | Revue de code et audit de sécurité complet (frontend, backend, API, base)
- **Contexte :** « test et fais un /code-review, corrige toutes les failles de sécurité, revue de tout le frontend,
  le backend, les API et la base de données ; je veux un système très sécurisé ».
- **Méthode :** /code-review des changements non commités (10 constats) + deux audits en lecture seule (backend/API/
  base ; frontend), chaque constat vérifié dans le code avant correction. Aucune faille critique ni élevée trouvée.
- **Corrigé (backend) :**
  - connexion : poste connu (cookie signé `fc_poste`, 90 j) dispensé du blocage par compte (plus de verrouillage d'un
    hôte par un tiers) ; `auth/rafraichir/` avec CSRF et jeton verrouillé (`select_for_update`) ;
  - borne : « C’est moi » exige le jeton signé `choix` de la recherche (plus d'émargement par `inviteId` arbitraire),
    12/min ; liste des cérémonies réduite en session borne (`EvenementBorneSerializer`) ;
  - limites par IP : IPv6 regroupées par /64 (`ident_reseau`, `AnonymeThrottle`) ; renvoi du QR compté par cérémonie
    (anciens liens compris) ; renvoi groupé de l'invitation 5/h et jamais deux fois en moins d'1 h ;
  - journaux : traces d'exception masquées (emails, téléphones), jeton du sondage masqué (Uvicorn, Caddy, erreurs) ;
  - sondage : réponses anonymes en base (plus de lien vers l'invité, `repondu` sans heure, heure arrondie), prénom
    non renvoyé pour un lien clos, cookie d'appareil 30 j, `CRON_SECRET` ≥ 32 caractères, aucun envoi après clôture
    ou annulation de présence, envoi par lots (budget 200 s) + second cron à 12 h sur Vercel ;
  - divers : libellés uniques des 3 emails (`LIBELLES_EMAIL`) dans l'historique, l'export et le journal, renvoi
    individuel du sondage refusé si désactivé, requêtes du suivi et de la vue d'ensemble regroupées, `max_length`
    sur les mots de passe et la sélection groupée, `X_FRAME_OPTIONS = DENY`, Referrer-Policy `same-origin`,
    migration 0008 qui annonce le nombre d'invités supprimés.
- **Corrigé (frontend) :** borne (disposition figée, restriction retentée toutes les 15 s et au retour du réseau,
  badge, espace hôte refermé après 90 s) ; historique du scan effacé à la déconnexion, file hors ligne purgée après
  7 jours, avertissement si des émargements attendent ; jeton du sondage normalisé dans les signalements d'erreurs ;
  CSP sans `data:` dans `frame-src` ; copie hors ligne des cérémonies réduite ; carte Satisfaction avec état
  d'erreur et jour seul des commentaires ; échelle 0-10 en deux rangées sur mobile, au clavier ; erreurs reliées
  aux questions ; aperçu d'email protégé contre les réponses dans le désordre ; temps réel pour le suivi des emails.
- **Dépendances :** React Router 7.18.4 (redirection ouverte corrigée), Vite 7.3.7, @vitejs/plugin-react 5.2,
  Vitest 5.0.4, vite-plugin-pwa 2.0, Playwright 1.64, @axe-core/playwright 4.13, PostCSS et ESLint à jour ;
  `npm audit --omit=dev` : 0 vulnérabilité ; `pip-audit` : 0. Serveur Vite limité à `.` et `../shared`, port 5173
  publié sur 127.0.0.1 ; image de développement Node 24.
- **Validation :** pytest SQLite 241/242 (échec connu propre à SQLite) dont les nouveaux tests de sécurité ; ruff ;
  `makemigrations --check` ; `check --deploy` (reste : HSTS preload, à décider) ; ESLint + Prettier ; Vitest 64/64 ;
  build ; e2e 3/3 (audit axe : iframes d'aperçu exclues) ; parcours borne 18/18 ; « C’est moi » de bout en bout.
- **Risques ou limites :** R10 (IP du client sur Vercel, à confirmer), R11 (pas de CAPTCHA), R12 (durcissements
  laissés en l'état, Tailwind 3 en développement). Migration 0009 régénérée (jamais appliquée sur une base durable).

## [2026-10-14] deploy | Sondage, suivi des emails et sécurité en ligne (Vercel)
- **Contexte :** « fais les » (commit, push, déploiement, `CRON_SECRET`, migrations Neon), après tests et revue.
- **Modifications :** commit `bd4f807` poussé ; CI verte (pytest MySQL, frontend, Playwright) ; variable
  `CRON_SECRET` (aléatoire, 48 caractères, type Secret) créée sur `flex-checking-api` sans être affichée ; backend
  déployé (un premier essai refusé « Not authorized », le second a réussi) ; frontend déployé au push.
  Migrations Neon `0008` (46 invités inscrits dans le futur supprimés) et `0009` (tables du sondage) appliquées
  depuis le poste avec `DATABASE_URL_UNPOOLED` (les variables sensibles de Vercel ne sont pas lisibles par
  `vercel env pull` : clé secrète jetable locale, inutile à la migration). Crons : Vercel fusionnait les deux crons
  du même chemin → chemins distincts `?passage=8h` et `?passage=12h`.
- **Validation :** en ligne : `/api/sante/` ok ; sondage à jeton inconnu 404 ; cron sans secret ou avec un faux secret
  404 ; `auth/rafraichir/` sans CSRF 403 ; annulation sans session 401 ; page `/sondage/…` servie, bundle
  `SondagePage` présent ; CSP sans `data:` dans `frame-src`, Referrer-Policy `same-origin`.
- **Risques ou limites :** données de démo du sondage (éditions 2025) non semées sur Neon ; premier envoi réel du
  sondage au lendemain d'une cérémonie (à observer dans Suivi des emails).

## [2026-10-21] tests | Refactorisation de `parcours.spec.js`

- **Contexte :** demande de refactorisation du parcours e2e, sans changement de comportement.
- **Modifications :** aide `evenementPmdOuvert` (connexion + recherche de l'événement PMD ouvert, désormais vérifiée
  aussi dans le test temps réel) et `urlInvites` partagées par les deux tests ; étapes numérotées du parcours
  devenues des `test.step` (visibles dans le rapport et les traces) ; contexte public créé via les fixtures
  `browser` et `baseURL` au lieu de l'URL `http://localhost:5174` codée en dur ; champs du formulaire remplis en
  boucle ; fixture `request` inutilisée (et `void request`) retirée.
- **Fichiers concernés :** `frontend/e2e/parcours.spec.js`
- **Validation :** ESLint + Prettier ok ; `npx playwright test --list` : 3 tests chargés. `npm run e2e` **non
  exécuté** (Docker arrêté : MySQL et Redis injoignables).
- **Risques ou limites :** à rejouer avec `npm run e2e` avant de considérer la refactorisation validée.

## [2026-10-21] documentation | /wiki-maj : wiki resynchronisé sur `be899ff`

- **Contexte :** 37 pages signalées à revérifier (sources modifiées par `ffa45e4`, `bd4f807`, `be899ff` après leur
  vérification sur `dc0c75a` / `36389e6`).
- **Modifications :** toutes les pages revérifiées contre le code (diffs relus), frontmatter `verifie: 2026-10-21`,
  `commit: be899ff`, `sources` réduites aux fichiers lus. Corrections notables :
  - `architecture/data-model.md` : `ReponseSondage` est anonyme (pas de lien vers l'invitation) ;
    `InvitationSondage.repondu` assure « une réponse par lien ».
  - `specifications/functional-requirements.md` : EF-24 citait une vue inexistante (`VueRecherche` →
    `vues_scan.RechercheBorneView`) ; ajout de EF-26 (sondage) et EF-27 (suivi des emails).
  - `architecture/components.md` : `ConnexionCompteThrottle` n'existe plus ; `ApercuEmails.jsx` supprimé retiré partout.
  - `api/endpoints.md` : réponse réelle du cron (`{programmes, envoyes}`, 404 si `CRON_SECRET` absent ou < 32 car.).
  - `features/sondage-satisfaction.md` : 18 tests backend / 7 frontend ; prénom masqué dès que le lien n'est plus ouvert.
  - `features/scan-emargement.md`, `temps-reel.md`, `hors-ligne.md` : jeton `choixBorne`, sujet `sondage`,
    intervalles de secours, purge à 7 jours.
  - `testing/test-strategy.md` : 242 tests backend collectés, 64 Vitest, 3 Playwright.
  - `project/risques-et-dette.md` : R13 (« C'est moi » hors ligne pouvant bloquer la file), R14 (renvoi n°2 sans
    `magazine_actif`), R15 (petits écarts : `ignores` non affiché, email n°3 hors liste, `X-Frame-Options`,
    `CRON_SECRET` absent de `.env.example`), R16 (sondage Vercel après 12 h) ; R7 atténué ; R4 complété.
  - `project/roadmap.md` : historique des 13 et 14 octobre ; `index.md` : date de vérification et libellé des risques.
- **Fichiers concernés :** les 37 pages signalées, plus `project/roadmap.md`, `index.md`.
- **Validation :** `python3 Cerveau/outils/lint_wiki.py` ; comptages par `pytest --collect-only` et
  `playwright test --list` (aucun test exécuté).
- **Risques ou limites :** `testing/test-cases.md` reste signalé tant que `frontend/e2e/parcours.spec.js` n'est pas
  commité. README et `PLAN.md` toujours en retard (R2, R4), hors périmètre du wiki. R13 déduit du code, non testé.

## [2026-10-21] documentation | Guide de déploiement sur VPS Infomaniak

- **Contexte :** demande d'un guide pour déployer toutes les fonctionnalités sur Infomaniak au moindre coût.
- **Modifications :** nouvelle page `operations/deploiement-infomaniak.md` (VPS Lite 2 vCPU / 4 Go, Docker,
  DNS, `.env` de production et réglages « petit serveur », SMTP de la messagerie existante, sauvegardes MySQL,
  contrôles fonctionnalité par fonctionnalité, test de charge, mises à jour). Nouveau risque R17 : exports lourds
  introuvables en production Docker (pas de volume commun entre Celery et Django), contourné dans le guide par
  `docker-compose.infomaniak.yml`. Index mis à jour.
- **Fichiers concernés :** `Cerveau/operations/deploiement-infomaniak.md`, `Cerveau/project/risques-et-dette.md`,
  `Cerveau/index.md` ; code lu : `docker-compose.prod.yml`, `backend/apps/noyau/taches.py`,
  `backend/apps/noyau/vues_invites.py`, `backend/config/settings.py`.
- **Validation :** procédure non exécutée (aucun VPS) ; `lint_wiki.py` relancé.
- **Risques ou limites :** dimensionnement estimé, à confirmer par le test de charge sur le VPS ; tarifs
  Infomaniak non vérifiés sur la page officielle ; R17 à corriger dans le dépôt.

## [2026-10-22] sécurité | Audit de durcissement : sessions, borne, emails, déploiement

- **Contexte :** audit de sécurité et de fiabilité du 2026-10-22 ; changements de code non commités (base `be899ff`),
  wiki resynchronisé selon `/wiki-maj`.
- **Modifications (code, constatées dans `git diff`) :**
  - Réseau : `docker-compose.yml` publie Django 8000 et Caddy 443 sur `127.0.0.1` (8443 reste ouvert au réseau local
    pour le scan sur téléphone) ; en production seuls 80/443 sont publiés. `.gitignore` renforcé (`.env.*`, clés,
    sauvegardes SQL, `.claude/settings.local.json`) ; audit des secrets : aucun secret réel dans le dépôt ni l'historique.
  - `docker-compose.prod.yml` : volume `media-data:/app/media` partagé (**R17 résolu**) ; `innodb-flush-log-at-trx-commit=2`
    retiré (durabilité par défaut).
  - Sessions : poste connu avec son propre compteur d'échecs (20/h) ; rafraîchissements simultanés → 409
    `SESSION_DEJA_RENOUVELEE` sans effacer les cookies (`_renouvele_par_un_autre_onglet`, `lib/api.js`) ; déconnexion →
    `perimetre` et fermeture 4001 du WebSocket de la session ; désactivation d'un compte → `nouvelle_version_session`.
  - Emails : renvoi du n°2 refusé si `magazine_actif` est faux (**R14 résolu**) ; renvoi individuel du n°3 seulement
    après un échec, 202 sans envoi si l'invité a répondu (anonymat) ; `_remplacer` en une passe ; `Message-ID` stable ;
    relance des tentatives perdues (> 1 h).
  - **Bug corrigé** : `JSON_UNDERSCOREIZE.no_underscore_before_number` passé à `False` : les modèles d'emails modifiés
    par le super admin n'étaient jamais enregistrés depuis le premier commit.
  - Scan : `MAX_CODES_INVALIDES_BORNE` = 10 ; résultat `ANNULE_DEPUIS` pour un scan rejoué antérieur à une annulation ;
    `fileHorsLigne.rejouer` retire un 403 `CHOIX_BORNE_INVALIDE` (**R13 résolu**).
  - Caractères de contrôle refusés : nom du programme, objets des emails, `poste`, motifs d'annulation, commentaire du
    sondage (`sans_controle_multiligne` + miroir `CONTROLE_MULTILIGNE_RE`).
  - `seed_demo` refusé hors `DEBUG` sans `--force` ; Pillow 13.0.0 ; CI en `permissions: contents: read`.
- **Modifications (wiki) :** `api/endpoints.md`, `features/authentification.md`, `scan-emargement.md`, `hors-ligne.md`,
  `emails.md`, `sondage-satisfaction.md`, `configuration-super-admin.md`, `gestion-invites.md`, `temps-reel.md`,
  `specifications/non-functional-requirements.md` (ENF-S12 ajouté), `testing/test-cases.md`, `testing/test-strategy.md`,
  `operations/setup.md`, `operations/deployment.md`, `operations/deploiement-infomaniak.md` (étape 5 simplifiée : plus
  de `docker-compose.infomaniak.yml` ; `DEFAULT_FROM_EMAIL` en adresse seule ; `seed_demo --force`),
  `decisions/ADR-012-sondage-satisfaction.md`, `project/risques-et-dette.md`, `index.md`.
  Risques : R13, R14, R17 résolus ; R15 revérifié (inchangé) ; nouveaux R18 (inscription automatisable, lié à R11),
  R19 (codes de borne devinables), R20 (dernier qui écrit gagne), R21 (migrations sans expand/contract), R22 (images non
  épinglées, Redis sans mot de passe), R23 (un avis par appareil), R24 (journaux de `runserver` avec `?q=`) ; R6 inchangé.
- **Fichiers concernés :** `docker-compose.yml`, `docker-compose.prod.yml`, `.gitignore`, `.github/workflows/ci.yml`,
  `backend/config/settings.py`, `backend/requirements.txt`, `backend/apps/comptes/views.py`,
  `backend/apps/noyau/{consumers,emails,serializers,services,sondages,tasks,validation,vues_admin,vues_invites,vues_scan,vues_sondage}.py`,
  `backend/apps/noyau/management/commands/seed_demo.py`, `frontend/src/lib/{api,schemas}.js`,
  `frontend/src/features/scan/{ScanPoste.jsx,composants.jsx,fileHorsLigne.js,retour.js}`,
  `frontend/src/features/invite/SondagePage.jsx` ; tests `backend/apps/noyau/tests/test_durcissement.py` (nouveau),
  `test_audit_securite.py`, `test_invites.py`, `test_sondage.py`, `test_temps_reel.py`, `frontend/tests/fileHorsLigne.test.js` (nouveau).
- **Validation :** contrôles exécutés le 2026-10-22 (rapportés par la session de développement) : pytest sur MySQL 8
  (Docker) 257 passed ; ruff check + format OK ; Vitest 66/66 (15 fichiers) ; ESLint + Prettier OK ; `npm run build`
  OK ; Playwright 3/3 après `migrate` + `seed_demo`. `python3 Cerveau/outils/lint_wiki.py` : 0 erreur.
- **Décision :** mise à jour de [ADR-012](decisions/ADR-012-sondage-satisfaction.md) (renvoi individuel du sondage).
- **Risques ou limites :** modifications non commitées : le script signale les pages comme « à revérifier » jusqu'au
  commit (relancer `/wiki-maj` ensuite). R18, R19, R21 restent à trancher (MDE) ; l'estimation de 25 % de R19 vient
  de l'audit, non recalculée. Le renvoi groupé du n°3 (A7) compte désormais les invités ayant répondu comme
  traités, sans leur envoyer d'email (`suivi_emails.renvoyer_echecs`) : `traites` ne révèle plus de réponse
  (pytest relancé : 257 passed).

## [2026-10-22] sécurité | Protection des données personnelles (conservation limitée, politique de confidentialité)

- **Contexte :** demande d'un dispositif de protection des données à caractère personnel (application publique).
- **Modifications :** module `donnees_personnelles.py` (anonymisation des invités des cérémonies plus anciennes que
  la durée de conservation : identité effacée, QR invalidé, erreurs d'envoi et liens du sondage supprimés,
  journal `DONNEES_ANONYMISATION`) ; tâche nocturne `anonymiser_donnees` (Beat 3 h 30) et passage par le cron
  Vercel ; réglages super admin `duree_conservation_mois` (1–60, défaut 12) et `contact_donnees` (migration `0010`,
  `db_default`) ; route publique `public/confidentialite/` ; page `/confidentialite` (loi n° 2013-450, droits,
  ARTCI) reliée au consentement et au pied des emails ; section « Données personnelles » des Paramètres.
- **Fichiers concernés :** voir [donnees-personnelles](features/donnees-personnelles.md) (sources).
- **Validation :** pytest MySQL **264 passed** ; ruff OK ; `makemigrations --check` sans changement ; Vitest
  **68/68** ; ESLint + Prettier OK ; build OK ; Playwright **3/3** (audit axe de `/confidentialite` compris).
- **Décision :** [ADR-013](decisions/ADR-013-conservation-limitee-anonymisation.md).
- **Risques ou limites :** anonymisation irréversible (durée réglée trop courte = effacement dès la nuit suivante) ;
  sauvegardes antérieures non anonymisées (chiffrement et rotation dans le guide) ; formalités ARTCI à vérifier par
  MDE ; texte du consentement toujours « conformément au RGPD » (R8, non modifié).

## [2026-10-22] architecture | Docker : images allégées, journaux plafonnés, disque libéré

- **Contexte :** « docker est full » : Docker Desktop bloqué (« no space left on device » : disque du Mac à 2,2 Go
  libres), demande d'optimiser images et conteneurs sans toucher aux fonctionnalités ni à la sécurité.
- **Modifications :** `backend/Dockerfile` en plusieurs étapes (compilateurs seulement dans l'étape `construction`,
  image d'exécution avec `libmariadb3` et `/opt/venv`) ; compose : rotation des journaux (`x-journaux`, 3 × 10 Mo),
  image `dev` unique, journaux binaires MySQL 3 jours (dev et prod). Ménage : conteneurs arrêtés, images inutilisées
  (anciennes images du backend, `flex-vercel-test`, `postgres:16-alpine`, `node:20-alpine`, `ubuntu`,
  `hello-world`), 3 volumes anonymes orphelins (anciennes bases Postgres de test), cache de construction ; caches
  npm et pip du poste vidés. Volumes nommés conservés.
- **Fichiers concernés :** `backend/Dockerfile`, `docker-compose.yml`, `docker-compose.prod.yml`.
- **Validation :** image `prod` 558 Mo (≈ 1 Go avant), sans compilateur, utilisateur `flex`, modules natifs chargés,
  `/api/sante/` et `/api/public/confidentialite/` en 200 contre MySQL + Redis ; image `dev` 617 Mo, **264 tests
  passés** dans le conteneur ; `docker compose config` valide (dev et prod). `Docker.raw` 8,1 → 5,1 Go ; disque du Mac
  2,2 → 6,5 Go libres.
- **Risques ou limites :** le disque du Mac reste presque plein (6,5 Go) : Docker se bloquera de nouveau s'il se
  remplit ; les images de base (`python:3.12-slim`, `mysql:8.0`) ne sont pas épinglées par empreinte (R22).

## [2026-10-22] sécurité | Revue de code de d91d426 et des optimisations Docker : 13 corrections

- **Contexte :** demande « test, /code-review, corrige les failles, puis commit, push et deploy ».
- **Modifications :**
  - Sondage : renvoi individuel et groupé identiques que l'invité ait répondu ou non (réponse, journal, statut,
    envoi) ; plus aucun moyen de déduire qui a répondu (`sondage_repondu` supprimé).
  - Données personnelles : invités ajoutés après une anonymisation traités à la passe suivante
    (`evenements_expires` par invités identifiables) ; `consentement_le` et motifs d'annulation effacés ;
    confirmation avant de raccourcir la durée ; politique de confidentialité alignée sur le fonctionnement réel
    (prestataires techniques et transferts, retrait du consentement, avis anonymes conservés) ; consentement :
    « conformément à la loi ivoirienne n° 2013-450 » au lieu de « RGPD » (R8) ; catégorie « Données personnelles »
    dans le filtre du journal.
  - Borne : jeton « C'est moi » jugé à l'heure du passage (5 min, rejeu jusqu'à 12 h) → plus de passage hors ligne
    perdu ; garde `ANNULE_DEPUIS` comparée à l'heure de l'appareil (rejeu de plus de 12 h compris).
  - Emails : `Message-ID` incluant l'hôte public et la date de création (base de test ≠ production) ; champ
    `EmailEnvoye.derniere_tentative_le` (migration `0011`) : la relance ne reprend que les envois dont la dernière
    tentative date de plus d'1 h.
  - Sessions : course des onglets limitée à un jeton émis dans la fenêtre de la rotation ; déconnexion → message
    `session_fermee` qui ne ferme que la connexion temps réel de ce jeton (sans réveiller les autres sessions).
  - MySQL : journaux binaires 7 jours (et non 3) tant que les sauvegardes ne sont pas automatisées dans le dépôt.
- **Écarté (décision MDE, R19) :** blocage de la borne après 10 codes faux (déni de service possible) contre
  devinette des codes : inchangé.
- **Validation :** pytest MySQL **266 passed** ; ruff OK ; Vitest **68/68** ; ESLint + Prettier OK ; build OK ;
  Playwright **3/3** ; image prod reconstruite et vérifiée (santé 200).

## [2026-10-22] deploy | Sécurité, données personnelles et revue de code en ligne (Vercel)

- **Contexte :** « si tout est bon commit push et deploy ».
- **Modifications :** commits `d91d426` et `7e0e071` poussés ; migrations Neon `0010` (données personnelles) et
  `0011` (dernière tentative d'envoi) appliquées avec l'URL non poolée, avant le déploiement (colonnes ajoutées
  avec valeur par défaut : compatibles avec la version précédente) ; backend `flex-checking-api` déployé
  (`vercel deploy --prod`, deux déploiements identiques, le plus récent en production) ; frontend déployé au push.
  Fichier d'environnement Vercel récupéré dans le dossier temporaire de la session puis supprimé.
- **Validation :** en ligne : `/api/sante/` 200 ; `/api/public/confidentialite/` 200 (`dureeConservationMois` 12,
  contact vide) ; page `/confidentialite` servie ; cron sans secret 404 ; `/api/evenements/` sans session 401 ;
  `auth/rafraichir/` sans CSRF 403 ; HSTS, CSP, Referrer-Policy présents.
- **Risques ou limites :** renseigner le contact « données personnelles » dans Super admin › Paramètres ;
  formalités ARTCI à vérifier par MDE.

## [2026-10-23] sécurité | Alertes PHP et Node.js du 21/10/2026 : vérification et mise à niveau de Node.js

- **Contexte :** vidéo signalant des failles critiques PHP (« PHP2Shell ») et Node.js ; vérification sur php.net et
  nodejs.org. php.net : CVE-2026-109618 et CVE-2026-109619 (exécution de code à distance sans authentification,
  CVSS 4.0 9,2), corrigées dans 8.5.12 / 8.4.27 / 8.3.36 / 8.2.35 ; « PHP2Shell » et l'exploitation « déjà en cours »
  ne figurent pas sur php.net (exploit démontré seulement). nodejs.org : 10 failles dont 4 élevées (CVE-2026-111497 :
  écriture hors limites du décodeur Brotli, exécution de code à distance), corrigées dans 22.23.4 / 24.22.1 /
  26.12.1. Projet : aucun PHP ; Node.js sert seulement à construire et tester le frontend (production : fichiers
  statiques), sur le poste (v24.13.0), le conteneur de développement, la CI, Vercel et le test de charge (Node 20).
- **Modifications :** minimum Node 24.22.1 imposé partout par `frontend/package.json` (`engines`) et
  `frontend/.npmrc` (`engine-strict=true`) — y compris le build Vercel ; étiquettes flottantes toujours
  re-téléchargées (`node:24-alpine` + `pull_policy: always`, `--pull always`) ; CI : `node-version-file:
  frontend/.nvmrc` (« 24 ») + `check-latest` ; test de charge : Node 24 au lieu de 20 ; guide : veille de sécurité en
  section propre, reconstruction avec `docker compose build --pull`.
- **Fichiers concernés :** `frontend/package.json`, `frontend/.npmrc`, `frontend/.nvmrc`, `docker-compose.yml`,
  `.github/workflows/ci.yml`, `infra/charge/README.md`, `Cerveau/operations/deploiement-infomaniak.md`,
  `Cerveau/operations/setup.md`, `Cerveau/testing/test-strategy.md`.
- **Validation :** conteneur `node:24-alpine` (v24.22.1) : `npm ci`, lint, Vitest **68/68**, build OK ; garde-fou
  vérifié dans `node:24.13.0-alpine` : `npm ci` refusé (`EBADENGINE`, `Required: ^24.22.1`) ; `package-lock.json` :
  seuls `engines` et des drapeaux `peer` réordonnés (aucune version modifiée) ; pytest MySQL **266 passed** ;
  `docker compose config` OK ; `ci.yml` relu (YAML valide). Revue de code : 9 remarques, toutes traitées.
- **Décision :** une seule version minimale (`engines`) plutôt qu'un numéro figé à plusieurs endroits.
- **Risques ou limites :** le Node.js du poste (v24.13.0, `/usr/local/bin`) doit être mis à jour par l'utilisateur :
  `npm ci` y est désormais refusé (EBADENGINE) ; si Vercel construisait encore avec une 24.x antérieure à 24.22.1,
  le build échouerait (la version en ligne resterait la précédente) — à vérifier au prochain déploiement.

## [2026-10-26] documentation | /wiki-maj : wiki resynchronisé sur `44eceb5`

- **Contexte :** 38 pages signalées « à revérifier » par `lint_wiki.py` après les commits `d91d426` et `7e0e071`
  (2026-10-22) et la mise à niveau de Node.js non commitée (2026-10-23).
- **Modifications :** les 38 pages revérifiées contre le code (diffs `be899ff..44eceb5` et `git diff`), `verifie`
  2026-10-26, `commit` 44eceb5, `sources` ajustées. Corrections de fond :
  - Sondage : le renvoi individuel et groupé du n°3 ne dépend plus de la réponse de l'invité (`sondage_repondu`
    supprimé) ; l'ancien « 202 sans envoi » et « lien sans réponse » étaient faux dans `api/endpoints.md`,
    `gestion-invites.md`, `tableau-de-bord.md`, `emails.md`, `sondage-satisfaction.md`, ADR-012.
  - Sessions : déconnexion → message `session_fermee` (au lieu de `perimetre`) ; 409 `SESSION_DEJA_RENOUVELEE` limité
    aux jetons émis dans la fenêtre de rotation (`authentification.md`, `temps-reel.md`, ADR-002, ADR-006).
  - Borne : jeton « C'est moi » jugé à l'heure du passage (5 min, rejeu 12 h), `ANNULE_DEPUIS` comparé à l'heure de
    l'appareil (`scan-emargement.md`, `hors-ligne.md`, ADR-010, ADR-011).
  - Emails : relance par `EmailEnvoye.derniere_tentative_le` (migration `0011`), `Message-ID` avec l'hôte public.
  - Données personnelles : critère « invités encore identifiables », effacement de `consentement_le` et des motifs,
    consentement « loi n° 2013-450 », confirmation de réduction de durée (interface seulement) ; ADR-013 décision 5.
  - Modèle de données : migrations jusqu'à `0011`, `comptes/0002_version_session` ajoutée (manquait).
  - Exploitation : journaux binaires MySQL **7 jours** (la page `setup.md` disait 3), image backend multi-étapes,
    journaux de conteneurs plafonnés, migrations Neon 0008–0011.
  - Spécifications : EF-28 (données personnelles), ENF-S13 (conservation limitée), ENF-S14 (chaîne de construction).
  - Tests : `test_donnees_personnelles.py`, compléments de `test_durcissement.py`, volumes 266 / 68 ; « Dernière
    exécution » complétée avec les seuls résultats consignés dans ce journal.
  - `index.md` : date, EF-01 à EF-28, R8 atténué.
- **Fichiers concernés :** 38 pages de `Cerveau/` (voir `git status Cerveau`), `Cerveau/index.md`.
- **Validation :** `python3 Cerveau/outils/lint_wiki.py` : 0 erreur, 0 avertissement ; 9 pages encore signalées
  uniquement à cause des fichiers Node.js non commités (`frontend/package.json`, `.npmrc`, `.nvmrc`,
  `docker-compose.yml`, `ci.yml`, `infra/charge/README.md`), dont le contenu est déjà décrit. Aucune suite de tests
  relancée pour ce passage.
- **Risques ou limites :** R8 passe à 🟡 atténué (la case de consentement ne nomme toujours ni l'email n°2 ni le
  sondage) ; R13, R21, R22, R23 complétés ; nouvelle limitation assumée : confirmation de réduction de la durée de
  conservation absente de l'API. Lacunes de tests notées : déconnexion sans effet sur les autres appareils, fenêtre de
  rotation entre onglets. README toujours en retard (R4 : 79 tests annoncés ; écran I7). Relancer `/wiki-maj` après le
  commit de la mise à niveau Node.js.

## [2026-10-26] lint | Revue de l'affichage des pages du wiki

- **Contexte :** contrôle du rendu Markdown (Obsidian, GitHub) après le `/wiki-maj` du jour.
- **Modifications :** `api/endpoints.md` : cinq lignes de tableau dont le code contenait un `|` non échappé
  (`xlsx|csv`, `INVITATION|MAGAZINE|SONDAGE`, `<invites|presences|…>`, `a_traiter|…`, `resoudre_tout|…`) découpaient
  la cellule en colonnes supplémentaires ; pipes échappés (`\|`).
- **Validation :** script ad hoc sur toutes les pages : colonnes des tableaux cohérentes, blocs de code fermés, aucune
  entité HTML ; frontmatter YAML valide partout (PyYAML) ; `lint_wiki.py` : 0 erreur.

## [2026-10-26] tests | Vérification complète avant commit

- **Contexte :** dernière vérification du code et des tests demandée avant de poursuivre (base `44eceb5` + mise à
  niveau Node.js non commitée ; aucun fichier applicatif modifié depuis).
- **Validation :** sur le poste (Node 24.22.1 ; MySQL et Redis du compose ; `migrate` + `seed_demo`) : `ruff check`
  et `ruff format --check` OK ; `pytest` **266 passed** ; `npm run lint` OK ; Vitest **68/68** ; `npm run build` OK ;
  `npm run e2e` **3/3** (parcours, temps réel, accessibilité axe) ; `docker compose config` OK ; `lint_wiki.py` :
  0 erreur (9 pages signalées à cause des fichiers Node.js non commités).
- **Autre :** essai d'un redesign avec le skill Impeccable (installé dans `.claude/skills/impeccable/`, sans hook)
  abandonné à la demande de l'utilisateur ; aucun fichier applicatif touché ; captures « avant » conservées dans
  `.impeccable/review/avant/`.
- **Risques ou limites :** le Node.js du poste est désormais en 24.22.1 (EBADENGINE levé) ; le build Vercel reste à
  vérifier au prochain déploiement.

## [2026-10-26] documentation | /wiki-maj : pages alignées sur `d220011`

- **Contexte :** commit et push de la mise à niveau de Node.js (`d220011`) ; 9 pages signalées par `lint_wiki.py`
  car leurs sources (`frontend/package.json`, `.npmrc`, `.nvmrc`, `docker-compose.yml`, `ci.yml`,
  `infra/charge/README.md`) ont changé dans ce commit.
- **Modifications :** diff de code de `d220011` relu (engines `^24.22.1`, `engine-strict`, `.nvmrc` « 24 »,
  `node-version-file` + `check-latest` en CI, `pull_policy: always`, test de charge `node:24-alpine --pull always`) :
  conforme au texte déjà écrit. `verifie`/`commit` mis à jour sur les 9 pages ; `operations/deployment.md` : le point
  ❓ « à vérifier au prochain déploiement » devient ✅ (build Vercel de production « Ready », site et
  `/confidentialite` en 200) ; ENF-S14 et `test-strategy.md` ne parlent plus de modifications non commitées ;
  `index.md` mis à jour.
- **Validation :** `vercel ls` / `vercel inspect` : déploiement de production du frontend « Ready » ; `curl` 200 ;
  `python3 Cerveau/outils/lint_wiki.py` relancé (voir ci-dessous).
- **Risques ou limites :** aucun risque nouveau ; le risque de build Vercel noté le 2026-10-23 est levé.

## [2026-10-26] correction | Lenteur des pages : pool de connexions Postgres, rafraîchissement de session sur Postgres

- **Contexte :** lenteur constatée au chargement des pages (environnement en ligne Vercel + Neon). Mesures `curl` :
  route sans base ≈ 0,16 s, `/api/sante/` (un `SELECT 1`) 0,6 à 1,1 s, premier appel après inactivité 5,2 s.
  Cause principale : une connexion TLS + SCRAM vers Neon ouverte à chaque requête (`CONN_MAX_AGE = 0`). Le code
  du frontend est déjà découpé par écran et mis en cache (immutable + PWA) : il n'est pas en cause.
- **Modifications :** (1) pool natif de Django pour Postgres (`config/bases.py` : `base_depuis_url(pool_max)`,
  `pool_postgres`, `CONN_HEALTH_CHECKS`) ; taille `DB_CONCURRENCE + 2` ; variable `DB_POOL` (défaut actif) ;
  dépendance `psycopg-pool==3.3.3` (publiée le 2026-09-22, paquet officiel de psycopg). Mêmes options de connexion
  (TLS, liaison de canal) ; MySQL inchangé. (2) `RafraichirView` : `order_by("pk")` sur le jeton verrouillé, car
  Postgres refusait le `FOR UPDATE` (jointure externe du tri par défaut) → 500 à chaque rafraîchissement sur Vercel
  (R25). (3) Frontend : le code de l'espace protégé (admin, scan, super admin) se télécharge en parallèle de
  `/auth/moi/` (`App.jsx` `charger*`, `RequireRole` `precharger`) au lieu d'après.
- **Fichiers concernés :** `backend/config/bases.py`, `backend/config/settings.py`, `backend/requirements.txt`,
  `backend/apps/comptes/views.py`, `backend/apps/noyau/tests/test_deploiement.py`, `frontend/src/App.jsx`,
  `frontend/src/features/auth/RequireRole.jsx`.
- **Validation :** `ruff check` / `ruff format --check` OK ; `pytest --create-db` **267 passed** sur MySQL et **267
  passed** sur un Postgres local avec le pool (avant la correction de `RafraichirView` : 6 échecs sur Postgres) ;
  essai ASGI (gunicorn + uvicorn) sur Postgres local : 100 appels de `/api/sante/` (dont 50 simultanés), tous en
  200, ouvrent 10 connexions avec le pool contre 100 sans ; `npm run lint` OK ; Vitest 68/68 ; `npm run build` OK ;
  `npm run e2e` 3/3. Un échec `seed_demo` observé avec `--reuse-db` venait d'une base de test périmée (OK avec
  `--create-db`).
- **Risques ou limites :** non déployé (gain en ligne à mesurer). Le démarrage à froid de la fonction Vercel (≈ 5 s)
  n'est pas traité. Neon via PgBouncer (mode transaction) : Django n'utilise pas de requêtes préparées côté serveur
  par défaut, compatible ; à surveiller dans les journaux après déploiement. R26 (réouverture après 15 min →
  connexion) relevé, non corrigé.

## [2026-10-26] deploy | Pool de connexions Postgres et rafraîchissement de session en ligne (Vercel)

- **Contexte :** « commite et déploie sur Vercel ».
- **Modifications :** commit `43f99c5` poussé (frontend déployé au push, « Ready ») ; backend `flex-checking-api`
  déployé par `vercel deploy --prod` (deux déploiements identiques, le second lancé par erreur, le plus récent en
  production, « Ready »). Aucune migration.
- **Validation :** en ligne, 30 appels chacun : `/api/sante/` médiane 0,17 s, p90 0,21 s (avant : 0,6 à 1,1 s) ;
  `/api/auth/csrf/` 0,16 s ; `auth/rafraichir/` sans CSRF 403 ; `/api/evenements/` sans session 401 ; CSP et HSTS
  présents sur `/connexion`.
- **Risques ou limites :** 404 de `public/evenements/<slug>/` à 1,04 s en ligne (4 ms en local), cause non
  identifiée ; démarrage à froid de la fonction (≈ 5 s) inchangé ; rafraîchissement de session non testé en ligne
  avec un vrai compte (couvert par pytest sur Postgres).

## [2026-10-26] documentation | /wiki-maj : pages alignées sur `2523cbb`

- **Contexte :** 27 pages signalées par `lint_wiki.py` après `43f99c5` (pool Postgres, `RafraichirView`,
  préchargement des espaces protégés), car leurs sources comprennent `settings.py`, `comptes/views.py`, `App.jsx`,
  `RequireRole.jsx` ou `apps/noyau/tests/`.
- **Modifications :** diff de `43f99c5` relu. Contenu mis à jour : `architecture/integrations.md` (pool Neon),
  `api/endpoints.md` (verrou du rafraîchissement trié par `pk`), `architecture/system-overview.md` (préchargement),
  `features/authentification.md` (`precharger`, renvoi vers R26), ADR-007 (Postgres non testé en CI, R25, pool),
  `specifications/non-functional-requirements.md` (pool et mesures en ligne), `testing/test-strategy.md` (267 tests
  sur MySQL et Postgres, nouvelle ligne « Dernière exécution »), `testing/test-cases.md` (nouveau test de
  `test_deploiement.py`). Les 20 autres pages ne décrivent aucun passage modifié : seuls `verifie`/`commit` ont
  été mis à jour. `index.md` : mention de la vérification. Aucun risque ajouté ni retiré (R25 résolu et R26 ouvert,
  déjà consignés).
- **Validation :** `python3 Cerveau/outils/lint_wiki.py` relancé : 50 pages, 0 erreur, 0 page à revérifier,
  0 avertissement. Aucun code modifié, contrôles backend et frontend non relancés.
- **Risques ou limites :** `Cerveau/.obsidian/graph.json` modifié par Obsidian, non touché.

## [2026-10-27] fonctionnalité | Formulaire d’inscription : le libellé du champ sert de placeholder

- **Contexte :** demande de remplacer les exemples affichés dans les champs (« Ex. KOUASSI », « nom@entreprise.ci »…)
  par le libellé du champ.
- **Modifications :** `CHAMPS` n’a plus de clé `ph` ; le placeholder de chaque champ vient de `NOMS_CHAMPS`
  (Nom, Prénom, Email, Téléphone, Entreprise, Fonction). Le libellé visible au-dessus du champ est conservé.
  Après la revue de code, le champ téléphone affiche l’aide « 10 chiffres, par exemple 07 12 34 56 78 » (prop
  `aide` de `Champ`, reliée par `aria-describedby`) pour ne pas perdre l’indication de format.
- **Fichiers concernés :** `frontend/src/features/invite/InscriptionPage.jsx`, `Cerveau/features/inscription.md`
- **Validation :** `npm run lint` OK, `npm test` 68/68, `npm run build` OK, `npm run e2e` 3/3 (parcours complet,
  temps réel, accessibilité axe) sur MySQL et Redis Docker. Revue de code : pas de défaut ; libellé répété dans le
  champ, conséquence assumée de la demande. Contrôles relancés après l’ajout de l’aide : lint, 68/68, build, e2e 3/3.
- **Risques ou limites :** le formulaire d’ajout manuel (`PanneauAjout.jsx`) garde ses exemples.

## [2026-10-27] deploy | Placeholders du formulaire d’inscription en ligne (Vercel)

- **Contexte :** push de `e206295` (commit de code `2365b1f`) sur `main`.
- **Modifications :** déploiement de production automatique du projet `flex-checking` (frontend seul ; le backend
  n’a pas changé, `flex-checking-api` non redéployé).
- **Validation :** `vercel inspect` : déploiement « Ready », cible production, alias `https://flex-checking.vercel.app`.
  Site en 200 ; le module `InscriptionPage` servi en ligne contient l’aide « 10 chiffres, par exemple
  07 12 34 56 78 » et plus aucun des anciens exemples (« Ex. KOUASSI », « nom@entreprise.ci »).
- **Risques ou limites :** formulaire non soumis en ligne (éviter un invité de test dans la base Neon) ; rendu
  vérifié par le contenu du module, pas par une capture d’écran.

## [2026-10-27] fonctionnalité | Sondage de satisfaction : questionnaire dans le corps de l'email n°3

- **Contexte :** demande de l'utilisateur (capture de l'email n°3) : « le formulaire ou le questionnaire du sondage
  doit se trouver directement dans le corps du mail, pas de redirection ». Option retenue par l'utilisateur :
  formulaire HTML dans l'email (AMP for Email et notes cliquables écartés, voir ADR-012).
- **Modifications :** gabarit `sondage.html` : les 3 questions (boutons radio), le commentaire et « Envoyer mon
  avis » dans la carte, bloc `<!--[if mso]>` avec l'ancien bouton pour Outlook, lien « Répondez en ligne » en
  secours. Nouvelle route `POST /api/public/sondages/<jeton>/reponse/` (`SondageReponseEmailView`, formulaire
  urlencodé, sans authentification, limite `sondage`) → `sondages.repondre` puis 303 vers la page du sondage ;
  question manquante → 303 avec `incomplet=1` et les notes valides, reprises par `SondagePage` (`noteRecue`).
  Réponses par l'email non soumises à l'unicité par appareil (tirage aléatoire, anonymat préservé).
- **Fichiers concernés :** `backend/templates/emails/sondage.html`, `backend/apps/noyau/vues_sondage.py`,
  `backend/apps/noyau/urls.py`, `backend/apps/noyau/emails.py`, `backend/config/settings.py` (commentaire),
  `backend/apps/noyau/tests/test_sondage.py`, `frontend/src/features/invite/SondagePage.jsx`,
  `frontend/tests/sondage.test.jsx` ; wiki : `features/sondage-satisfaction.md`, ADR-012, `api/endpoints.md`,
  `features/authentification.md`, `features/emails.md`, `architecture/system-overview.md`,
  `specifications/functional-requirements.md` (EF-26), `project/risques-et-dette.md` (R23 atténué),
  `testing/test-cases.md`, `testing/test-strategy.md`.
- **Revue de code (même jour), corrigée avant commit :** commentaire perdu sans message si refusé (CRLF compté
  double face à `maxlength`, caractère de contrôle) → nettoyé comme sur la page ; notes reprises au retour prises
  dans les valeurs converties ; paramètres effacés de l'adresse après lecture ; refus inattendus journalisés (code
  seul) ; libellés des notes partagés (`emails.LIBELLES_NOTES`, miroir commenté côté page) ; bloc Outlook non
  dupliqué ; texte de secours « … ou le bouton ne réagit pas ». Demande de l'utilisateur « attention aux injections
  SQL et aux mails piratés » : jeton vérifié par sa forme avant la base, aucun SQL brut, champs en trop ignorés,
  test `test_formulaire_de_l_email_falsifie` ; un email piraté donne au plus une réponse anonyme ; SPF/DKIM/DMARC
  hors du code.
- **Validation :** ruff OK ; `pytest --create-db` **273 passed** (270 avant la revue ; MySQL Docker ; avec `--reuse-db`,
  `test_seed_demo_sans_date_future` échoue, base de test périmée, sans lien avec ce changement) ; `npm run lint`
  OK ; Vitest **69/69** ; build OK ; Playwright **3/3** ; rendu de l'aperçu de l'email capturé à 375 et 640 px.
- **Décision :** [ADR-012](decisions/ADR-012-sondage-satisfaction.md) (mise à jour du 2026-10-27).
- **Risques ou limites :** l'envoi du formulaire ouvre tout de même un onglet « merci » dans le navigateur
  (aucune messagerie n'envoie un formulaire sans cela, hors AMP) ; Outlook Windows n'affiche pas le formulaire
  (bouton conservé) ; non testé sur de vraies boîtes (Gmail mobile, Outlook.com, Yahoo) ; commentaire non repris si une
  question manque ; Postgres non relancé ; non déployé.

## [2026-10-27] deploy | Questionnaire dans l'email n°3 en ligne (Vercel)

- **Contexte :** « fait les » (commit, alignement du wiki, déploiement).
- **Modifications :** commits `bed9942` et `3106714` poussés (frontend déployé au push) ; backend
  `flex-checking-api` déployé par l'utilisateur (`vercel deploy --prod`, image `3106714f71f4`, « READY », alias
  `https://flex-checking-api.vercel.app`). Aucune migration.
- **Validation :** en ligne, via `https://flex-checking.vercel.app` : `/api/sante/` 200 ; `POST
  /api/public/sondages/<lien inconnu>/reponse/` (formulaire) → 303 vers `/sondage/<lien>` ; jeton `' OR '1'='1` → 303
  vers la page (jeton encodé, aucune requête en base) ; `GET` → 303 ; module `SondagePage` en ligne avec la reprise
  des notes. Aucune réponse réelle envoyée (base Neon).
- **Risques ou limites :** rendu et envoi non testés dans de vraies messageries (envoyer l'email de test n°3
  depuis Paramètres : son lien est factice, la page affichera « lien non valide ») ; SPF/DKIM/DMARC du domaine
  d'envoi à vérifier.

## [2026-11-02] tests | Revue de code : fixture `donnees_reference` complétée, index réaligné

- **Contexte :** « corrige l'en-tête de l'index » puis « /code-review et corrige » ; contrôles complets du §7.
- **Modifications :** en-tête de `index.md` aligné sur `bed9942` (frontmatter et phrase d'introduction : 30 pages
  alignées par `3106714`, le champ `commit` de chaque page fait foi). `donnees_reference` (fixture des tests)
  recrée désormais tous les statuts et programmes de la data migration `0002_donnees_initiales` au lieu de AMP et
  PMD seulement : `test_seed_demo_sans_date_future` échouait quand un test transactionnel avait vidé la base avant
  lui (`KeyError: 'Public-AMP'`), ce qui avait été attribué à tort à une base de test périmée. `.gitignore` :
  `.impeccable/` (captures d'écran locales) et le binaire natif `.claude/skills/impeccable/scripts/bin/`.
- **Fichiers concernés :** `Cerveau/index.md`, `backend/apps/noyau/tests/conftest.py`, `.gitignore`,
  `Cerveau/testing/test-strategy.md`.
- **Validation :** `ruff check` + `ruff format --check` OK ; `pytest` (MySQL 8 Docker, `--reuse-db`) **273 passed**
  (1 échec avant) ; `npm run lint` OK ; `npm test` **69/69** ; `npm run build` OK ; `npm run e2e` **3/3** ;
  `lint_wiki.py` : 0 erreur.
- **Risques ou limites :** aucun changement de code applicatif. `Cerveau/.obsidian/graph.json` (zoom du graphe,
  modification locale) laissé tel quel. Risques R2–R26 non traités dans cette session (décisions en attente).

## [2026-11-02] deploy | Correction de la fixture de tests et index du wiki en ligne (Vercel)

- **Contexte :** « commit, push deploy ».
- **Modifications :** commit `3616dd9` poussé sur `main` ; frontend `flex-checking` redéployé automatiquement au push
  (Production, « Ready »). Backend `flex-checking-api` non redéployé : aucun code exécuté en ligne n'a changé (seuls
  une fixture de tests, `.gitignore` et le wiki). Aucune migration.
- **Validation :** `https://flex-checking.vercel.app/` 200 ; `/api/sante/` 200.
- **Risques ou limites :** aucun.

## [2026-11-02] sécurité | Traitement des risques R2–R5, R7, R12, R15, R16, R21, R24–R26

- **Contexte :** « traite les risques ». Traitement des risques réglables sans décision de MDE ; les autres sont
  listés comme décisions en attente.
- **Modifications :**
  - R3 : entreprise et fonction obligatoires à la modification d'un invité (`ModificationInviteSerializer` hérite de
    `ChampsProfessionnelsObligatoires` ; `PanneauInvite.jsx` valide avec `schemaInviteComplet`, libellés « * »).
  - R26 : `lib/api.js` tente le rafraîchissement sur un 401 de `/auth/moi/` (liste `SANS_RAFRAICHISSEMENT` :
    connexion, rafraîchissement, CSRF, déconnexion).
  - R2 : branche morte `DEJA_INSCRIT` retirée de `EtatCarte.jsx`. R4 : README à jour (tests, I7, `CRON_SECRET`).
  - R15 : renvoi groupé — invités ignorés affichés ; `CRON_SECRET` dans `.env.example`.
  - R24 : journaux d'accès du runserver de développement masqués (`MasquerParametresUrl` accepte les arguments en
    dictionnaire, branché sur `django.channels.server`).
  - R7 / R16 : crons du sondage sur Vercel à 8 h, 12 h, 16 h et 20 h.
  - R5 / R25 : job CI `backend-postgres` (pytest sur Postgres 17).
  - R12 : **Zod 3 → 4** (vulnérabilité haute GHSA-mrhx-c7xc-m3w5 dans les dépendances livrées) ; `errorMap` /
    `invalid_type_error` → `error`, messages en français pour les champs absents.
  - R21 : convention de migration écrite ([ADR-014](decisions/ADR-014-migrations-expand-contract.md)), rappel au
    `CLAUDE.md` §5.
- **Fichiers concernés :** `backend/apps/noyau/serializers.py`, `backend/apps/noyau/logs.py`,
  `backend/config/settings.py`, `backend/vercel.json`, `backend/apps/noyau/tests/test_invites.py`,
  `backend/apps/noyau/tests/test_securite.py`, `frontend/src/lib/api.js`, `frontend/src/lib/schemas.js`,
  `frontend/src/features/invites/PanneauInvite.jsx`, `frontend/src/features/invites/GestionInvites.jsx`,
  `frontend/src/features/invite/EtatCarte.jsx`, `frontend/src/features/invite/InscriptionPage.jsx`,
  `frontend/tests/api.test.js`, `frontend/tests/schemas.test.js`, `frontend/package.json`,
  `frontend/package-lock.json`, `.github/workflows/ci.yml`, `.env.example`, `README.md` ; wiki : risques, ADR-014,
  CLAUDE.md, index, pages sondage, authentification, gestion des invités, inscription, ADR-005/007/012,
  déploiement, installation, intégrations, API, vue système, feuille de route, stratégie de test.
- **Validation :** `ruff check` + `ruff format --check` OK ; `pytest` **275 passed** sur MySQL 8 et **275 passed** sur
  Postgres 17 (conteneur temporaire) ; `npm run lint` OK ; `npm test` **73/73** ; `npm run build` OK ;
  `npm run e2e` **3/3** ; `npm audit --omit=dev` : 0 ; `lint_wiki.py` : 0 erreur (pages « à revérifier » dues aux
  modifications non commitées).
- **Décision :** [ADR-014](decisions/ADR-014-migrations-expand-contract.md).
- **Risques ou limites :** R26 non reproduit dans un vrai navigateur après 15 min ; quatre crons Vercel : limite du
  plan à confirmer au prochain déploiement du backend ; job CI Postgres non encore exécuté sur GitHub. Restent ouverts
  (décision MDE ou service externe) : R8, R10, R11, R18, R19, R20, R12 (HSTS preload, hachages, Tailwind 4) ;
  acceptés : R6, R9, R22, R23. Rien n'est commité.

## [2026-11-02] deploy | Traitement des risques en ligne (Vercel)

- **Contexte :** « commit push et deploy ».
- **Modifications :** commit `115df80` poussé sur `main` (`.claude/agents/` et `.claude/skills/impeccable/`, non
  suivis, laissés hors du commit) ; frontend `flex-checking` redéployé automatiquement au push (Production,
  « Ready ») ; backend `flex-checking-api` déployé par `vercel deploy --prod` depuis `backend/` (« Ready », alias
  `https://flex-checking-api.vercel.app`) : le déploiement a accepté les quatre crons (R7 / R16). `CRON_SECRET`
  présent en Production. Aucune migration.
- **Validation :** avant le commit : `ruff` OK, `pytest` 275 passed (MySQL 8), `npm run lint` OK, `npm test` 73/73,
  `npm run build` OK. En ligne : `https://flex-checking.vercel.app/` 200, `/api/sante/` 200 (via le frontend et
  directement) ; `/api/taches-planifiees/sondages/` sans secret → 404 (attendu).
- **Risques ou limites :** job CI `backend-postgres` à surveiller sur GitHub ; R3 et R26 non testés en ligne avec un
  compte admin.

## [2026-11-02] tests | Vérification en navigateur de R3 et R26, CI Postgres

- **Contexte :** « test et corrige » après le déploiement de `115df80`.
- **Modifications :** aucune correction de code nécessaire. Page [risques-et-dette](project/risques-et-dette.md) :
  preuves en navigateur ajoutées à R3 et R26.
- **Fichiers concernés :** `Cerveau/project/risques-et-dette.md`.
- **Validation :** CI GitHub de `115df80` et `913c7c4` : 4 jobs verts, dont le nouveau `backend-postgres` (R5 / R25).
  Spécification Playwright temporaire (supprimée après exécution) sur le backend local : R26 — cookie `fc_access`
  supprimé après connexion, rechargement → `/auth/moi/` 401, `/auth/rafraichir/` 204, `/auth/moi/` 200, pas de
  retour à `/connexion` ; R3 — modification avec entreprise vide et fonction en espaces → messages d'erreur, aucun
  `PATCH` ; `PATCH` direct `fonction: ""` → 400. 2/2 passed.
- **Risques ou limites :** vérifié en local, pas sur Vercel (pas de compte admin utilisé en ligne). La limite de
  5 connexions par minute s'est déclenchée pendant les essais, comme prévu.

## [2026-11-02] fonctionnalité | Scripts de déploiement VPS Lite et guide simplifié

- **Contexte :** « prépare le projet pour un déploiement sur VPS Lite », puis « rend le guide facile » et « ne
  remplace pas, crée un autre ». Le guide détaillé existant n'est pas modifié (seul un lien ajouté dans ses Liens).
- **Modifications :** nouveaux scripts `infra/vps/` : `commun.sh`, `preparer-serveur.sh` (système, swap, Docker,
  SSH par clé), `installer.sh` (`.env` en 4 questions avec secrets générés, construction du site, pile prod,
  `createsuperuser`), `activer-sauvegardes.sh`, `sauvegarde.sh`, `restaurer.sh`, `mettre-a-jour.sh`. Nouveau guide
  [deploiement-vps-facile](operations/deploiement-vps-facile.md) (8 étapes) ; dépôt public : `git clone` HTTPS,
  sans deploy key. Liens : index, [deployment](operations/deployment.md), guide détaillé, README § 7.
- **Fichiers concernés :** `infra/vps/*.sh`, `Cerveau/operations/deploiement-vps-facile.md`, `Cerveau/index.md`,
  `Cerveau/operations/deployment.md`, `Cerveau/operations/deploiement-infomaniak.md`, `README.md`.
- **Validation :** `bash -n` et `shellcheck -x` sans remarque. Copie isolée du dépôt (worktree, projet Compose
  `flexvpstest`, domaine `localhost`) : `installer.sh` avec réponses fournies → `.env` en `-rw-------`, 22 variables,
  mot de passe SMTP transmis sans apostrophes, pile démarrée, `migrate` `Exited (0)`, `/api/sante/` OK, en-têtes
  HSTS et CSP ; `createsuperuser --noinput` puis connexion `POST /api/auth/connexion/` → 200 `SUPER_ADMIN`.
  Dans Ubuntu 24.04 (conteneur, root) : `activer-sauvegardes.sh` (phrase, crontab unique après relance, première
  sauvegarde), `restaurer.sh` (donnée modifiée puis restaurée, refus sans « RESTAURER », refus avec mauvaise
  phrase). `mettre-a-jour.sh` (sans sauvegardes, réponse « o ») → reconstruction, santé OK. Pile et worktree de
  test supprimés.
- **Corrections trouvées par les tests :** `clear` faisait échouer `activer-sauvegardes.sh` hors terminal standard ;
  noms de sauvegarde à la minute → la sauvegarde de sécurité de `restaurer.sh` pouvait écraser le fichier à
  restaurer (secondes ajoutées, restauration depuis une copie temporaire) ; `sudo -n` dans `mettre-a-jour.sh`.
- **Risques ou limites :** `preparer-serveur.sh` non testé (exige un vrai serveur avec systemd) ; aucun VPS réel
  installé ; certificat Let's Encrypt et envoi SMTP réels non testés ; `mettre-a-jour.sh` testé sans nouvelle
  version à récupérer. Rien n'est commité.

## [2026-11-03] documentation | /wiki-maj : 31 pages revérifiées sur `107d1f8`

- **Contexte :** `lint_wiki.py` signalait 31 pages à revérifier après `3616dd9`, `115df80` et `107d1f8` (champ
  `commit` non mis à jour bien que la plupart des pages aient été corrigées dans `115df80`).
- **Modifications :** diffs de code relus (`logs.py`, `serializers.py`, `settings.py`, `vercel.json`, `ci.yml`,
  `EtatCarte.jsx`, `InscriptionPage.jsx`, `GestionInvites.jsx`, `PanneauInvite.jsx`, `lib/api.js`, `lib/schemas.js`,
  tests, `conftest.py`, `infra/vps/`). Écarts corrigés :
  [ADR-007](decisions/ADR-007-environnement-test-vercel.md) (CI Postgres depuis le 2026-11-02 ; quatre passages du
  sondage et non deux) ; [test-cases](testing/test-cases.md) (nouveaux tests `test_invites`, `test_securite`,
  `api.test.js`, `schemas.test.js`) ; EF-14 de [functional-requirements](specifications/functional-requirements.md)
  (entreprise et fonction obligatoires à la modification) ; `logs.py` dans [components](architecture/components.md)
  (masquage des URL, runserver compris) ; [scope](project/scope.md) (I7 retiré, cible VPS Lite préparée) ;
  [risques-et-dette](project/risques-et-dette.md) (résolution de R26 replacée sous R26 ; **R27 ajouté** : scripts
  VPS non éprouvés sur un vrai serveur) ; index (R1–R27). `verifie` / `commit` des 31 pages et de l'index → 2026-11-03 / `107d1f8`.
- **Fichiers concernés :** `Cerveau/` uniquement (31 pages, `index.md`, `log.md`).
- **Validation :** `python3 Cerveau/outils/lint_wiki.py` → 0 erreur, 0 page à revérifier, 0 avertissement. Aucun test de code lancé
  (aucun code modifié).
- **Risques ou limites :** les autres pages ont été comparées aux diffs par recherche ciblée des sujets modifiés, pas relues en
  entier. `Cerveau/operations/deploiement-vps-facile.pdf` reste non suivi par git.

## [2026-11-03] architecture | Allègement mémoire de la pile Docker

- **Contexte :** application jugée trop gourmande en RAM sur le poste de développement. Mesure, pile de développement démarrée : ≈ 1,6 Go pour l'ensemble des conteneurs (Vite 497 Mo, MySQL 450 Mo, Django 197 Mo, Celery 186 Mo, Celery beat 123 Mo) ; l'essentiel de la mémoire occupée sur le Mac vient de la machine virtuelle Docker Desktop (plafond 7,7 Go) et du navigateur.
- **Modifications :** `docker-compose.yml` : MySQL `--performance-schema=OFF` (450 → 127 Mo) ; worker Celery `--without-gossip --without-mingle --without-heartbeat`. `docker-compose.prod.yml` : worker Celery avec les mêmes options et `--max-memory-per-child 262144`. `--performance-schema=OFF` en production non appliqué (refusé par le contrôle de permissions de la session, en attente de décision).
- **Fichiers concernés :** `docker-compose.yml`, `docker-compose.prod.yml`, `Cerveau/operations/deployment.md`
- **Validation :** `pytest` backend → 275 réussis (MySQL sans performance_schema) ; `docker compose config` (dév. et prod.) valides ; worker de dév. : `celery inspect ping` → pong, tâche `relancer_emails_en_attente` exécutée (SUCCESS). Pile de production non lancée.
- **Risques ou limites :** sans performance_schema, plus de diagnostic fin des requêtes MySQL en développement. Frontend non modifié : déjà découpé par espace (scan, admin, super admin chargés à la demande).

## [2026-11-04] documentation | Domaine de production retenu : `inscription.mde.ci`

- **Contexte :** décision de l'utilisateur : l'adresse du système sera `inscription.mde.ci` (remplace l'exemple `emargement.mde.ci`).
- **Modifications :** défaut de `infra/Caddyfile.prod` et exemple de la question 1 de `infra/vps/installer.sh` passés à `inscription.mde.ci` ; guides VPS (enregistrement DNS A `inscription`, `dig`, URL de vérification), `deployment.md` et `scope.md` (domaine retiré des inconnus) mis à jour.
  Défaut `${DOMAINE:-…}` du service `proxy` de `docker-compose.prod.yml` aligné ensuite, sur demande explicite de l'utilisateur.
- **Fichiers concernés :** `docker-compose.prod.yml`, `infra/Caddyfile.prod`, `infra/vps/installer.sh`, `Cerveau/operations/deploiement-vps-facile.md`, `Cerveau/operations/deploiement-infomaniak.md`, `Cerveau/operations/deployment.md`, `Cerveau/project/scope.md`
- **Validation :** `bash -n infra/vps/installer.sh` OK ; `docker compose -f docker-compose.prod.yml config --quiet` sans erreur ; plus aucune occurrence de l'ancien domaine hors `design-source/` (maquette, source brute non modifiée).
- **PDF :** `Cerveau/operations/deploiement-vps-facile.pdf` régénéré depuis la page Markdown (conversion HTML puis impression Chrome sans interface, A4) ; rendu vérifié visuellement.
- **Risques ou limites :** le PDF reste non suivi par git ; à régénérer à chaque modification du guide.

## [2026-11-04] documentation | /wiki-maj : 13 pages revérifiées sur `e3dd153`

- **Contexte :** pages signalées par `lint_wiki.py` après le commit `e3dd153` (sources `docker-compose.yml`, `docker-compose.prod.yml`, `infra/Caddyfile.prod`, `infra/vps/installer.sh`).
- **Modifications :** diff du commit relu (options MySQL / Celery, domaine). Écarts corrigés : [deploiement-infomaniak](operations/deploiement-infomaniak.md) (enregistrements DNS A et AAAA : sous-domaine `inscription`, oublié le matin) ; [setup](operations/setup.md) (MySQL de développement sans `performance_schema`, options du worker Celery) ; [scope](project/scope.md) (`docker-compose.prod.yml` et `infra/Caddyfile.prod` ajoutés aux sources). Les 10 autres pages ne décrivaient rien de modifié : `verifie` / `commit` → 2026-11-04 / `e3dd153` pour les 13 ; phrase d'en-tête de l'index complétée.
- **Fichiers concernés :** `Cerveau/` uniquement (13 pages, `index.md`, `log.md`).
- **Validation :** `python3 Cerveau/outils/lint_wiki.py` → 0 erreur, 0 page à revérifier, 0 avertissement. Aucun test de code lancé (aucun code modifié).
- **Risques ou limites :** `Cerveau/operations/deploiement-vps-facile.pdf` inchangé (la page Markdown correspondante n'a changé que dans son frontmatter).

## [2026-11-04] correction | Premier déploiement réel (VPS Lite) : Celery en échec, ports 80/443 bloqués

- **Contexte :** première installation sur le VPS Lite « IHM-Server01 » avec `infra/vps/installer.sh`, domaine `inscription.mde.ci`. Coupure SSH pendant « Attente du démarrage » ; à la relance, l'application ne répond pas après 5 minutes.
- **Constats :** mysql, redis, django (healthy), migrate (0) et proxy démarrés. (1) Worker Celery en redémarrage : `kombu` non figé, la 5.7.0 installée sur le serveur exige redis-py ≥ 6.1 (`VersionMismatch`, `redis==5.2.1`). (2) Let's Encrypt « Timeout during connect » sur 80 et 443 ; téléphone en 4G : délai dépassé ; `tcpdump` sur `ens3` : aucun paquet vers le serveur sur 80/443, alors que le Firewall du Manager Infomaniak affiche TCP 80, TCP 443 et UDP 443 actifs, que `ufw` est inactif et `INPUT` en ACCEPT, et que le port 22 répond. Le réseau de MDE intercepte le HTTP : les tests `nc` / `curl` depuis le poste de MDE ne sont pas fiables.
- **Modifications :** `backend/requirements.txt` : `kombu==5.6.2` (version installée en local, avec laquelle passent les 275 tests). Pas encore commité ni poussé : le serveur clone depuis GitHub.
- **Fichiers concernés :** `backend/requirements.txt`
- **Validation :** `pip install --dry-run -r requirements.txt` sans conflit ; `pip index versions kombu` → 5.7.0 publiée. Tests non relancés (version déjà installée en local, aucun changement effectif sur le poste).
- **Risques ou limites :** blocage réseau côté Infomaniak à faire lever (règles à recréer, sinon support) ; R27 (scripts VPS non éprouvés) reste ouvert. À ajouter au guide : lancer `installer.sh` dans `tmux` et `ssh -o ServerAliveInterval=30`.

## [2026-11-05] correction | Déploiement VPS : Celery réparé, faux « unhealthy » de celery-beat

- **Contexte :** suite du premier déploiement (entrée du 2026-11-04). Après `git pull` de `bfb237a` et `docker compose up -d --build` sur le serveur : `celery` healthy, super admin créé, `celery-beat` affiché « unhealthy » alors que ses journaux montrent `relancer-emails-en-attente` envoyée toutes les 5 minutes.
- **Modifications :** `docker-compose.prod.yml`, service `celery-beat` : `healthcheck: disable: true` (il héritait du HEALTHCHECK de `backend/Dockerfile`, qui interroge `http://127.0.0.1:8000/api/sante/`, port que beat ne sert pas). [deployment](operations/deployment.md) mis à jour.
- **Fichiers concernés :** `docker-compose.prod.yml`, `Cerveau/operations/deployment.md`
- **Validation :** `docker compose -f docker-compose.prod.yml config --quiet` sans erreur ; option `disable: true` présente dans la configuration résolue. Pas encore appliqué sur le serveur.
- **Risques ou limites :** plus aucun contrôle de santé pour beat (un beat bloqué ne serait pas signalé par Docker). Ports 80/443 toujours injoignables depuis Internet (blocage côté Infomaniak, en cours de traitement par l'utilisateur).

## [2026-11-05] documentation | /wiki-maj : 11 pages revérifiées sur `9c6a8ba`

- **Contexte :** le contrôle automatique signalait 11 pages dont les sources (`backend/requirements.txt`, `docker-compose.prod.yml`) ont changé avec `bfb237a` (kombu figé en 5.6.2) et `9c6a8ba` (contrôle de santé de celery-beat désactivé).
- **Modifications :** [risques-et-dette](project/risques-et-dette.md) : R12 complété (dépendances transitives non figées, cas kombu) et R27 complété (écarts du premier déploiement réel : deux corrigés, ports 80/443 encore bloqués, limite « beat sans contrôle de santé ») ; [deployment](operations/deployment.md) : kombu figé dans la ligne celery ; [integrations](architecture/integrations.md) : versions redis-py / kombu ; [deploiement-infomaniak](operations/deploiement-infomaniak.md) §10.3 : `celery-beat` et `proxy` sans contrôle de santé, c'est normal ; résumé de R27 dans l'index. Les autres pages (system-overview, ADR-009, ADR-014, exports-rapports, deploiement-vps-facile, scope, non-functional-requirements) sont revérifiées sans changement de contenu ; seuls `verifie` et `commit` sont mis à jour.
- **Fichiers concernés :** `backend/requirements.txt`, `docker-compose.prod.yml` (lus) ; 11 pages du wiki, `Cerveau/index.md`.
- **Validation :** `python3 Cerveau/outils/lint_wiki.py` : 0 erreur, 0 page à revérifier, 0 avertissement.
- **Risques ou limites :** aucun code modifié. R27 reste ouvert tant que les ports 80/443 ne sont pas joignables.

## [2026-11-06] correction | Curseur renvoyé au premier champ à chaque frappe dans les fenêtres

- **Contexte :** constaté en production le 2026-11-06 (espace super admin) : à chaque caractère saisi dans un formulaire en fenêtre, le curseur revenait sur le premier champ.
- **Modifications :** `useFocusTrap` avait `onFermer` dans les dépendances de son effet ; la plupart des appelants (24 occurrences de `onFermer={() => …}`) passent une fonction recréée à chaque rendu, donc chaque frappe relançait l'effet, qui replaçait le focus sur le premier élément focalisable. `onFermer` est désormais lu via une référence ; l'effet ne dépend plus que de `actif` et `ref`. Corrige d'un coup `PanneauLateral`, `Dialogue` et les fenêtres du scan et du sondage. Test ajouté : `frontend/tests/focusDialogue.test.jsx`.
- **Fichiers concernés :** `frontend/src/components/ui/useFocusTrap.js`, `frontend/tests/focusDialogue.test.jsx`, `Cerveau/testing/test-cases.md`
- **Validation :** le nouveau test échoue sans la correction (2 échecs sur 4) et passe avec ; `npm run lint` OK ; `npm test` 77/77 (18 fichiers) ; `npm run build` OK. Non vérifié dans un vrai navigateur ni en production (correction non commitée, non déployée).
- **Risques ou limites :** aucun changement d'interface ni d'API. Les emails non reçus en production (même date) sont un problème distinct, en cours de diagnostic sur le serveur.

## [2026-11-06] fonctionnalité | Mention « merci de ne pas répondre » dans les emails

- **Contexte :** les emails partiront de `noreply@mde.ci` (compte Google Workspace, SMTP `smtp.gmail.com`, réponses neutralisées par un filtre ou une réponse automatique Gmail, côté MDE) ; la configuration du serveur est faite par l'utilisateur et n'est pas encore confirmée en production.
- **Modifications :** phrase « Cet email est envoyé automatiquement, merci de ne pas y répondre. » ajoutée au pied de page de `base.html` (donc emails n°1, n°2, n°3 en HTML) et aux trois versions texte. Test paramétré `test_mention_ne_pas_repondre`. Page [emails](features/emails.md) complétée.
- **Fichiers concernés :** `backend/templates/emails/base.html`, `backend/templates/emails/invitation.txt`, `backend/templates/emails/magazine.txt`, `backend/templates/emails/sondage.txt`, `backend/apps/noyau/tests/test_emails.py`, `Cerveau/features/emails.md`
- **Validation :** `ruff check` et `ruff format --check` OK ; `pytest` : suite complète verte (MySQL Docker local) ; le nouveau test échoue sans la modification des gabarits. Rendu non vérifié dans une vraie messagerie.
- **Risques ou limites :** aucune adresse de contact n'est indiquée (non fournie) ; non commité, non déployé. L'exemple `mail.infomaniak.com` de `infra/vps/installer.sh` et du guide reste à remplacer une fois l'envoi Google Workspace confirmé.

## [2026-11-09] sécurité | QR codes malveillants : contrôle du format, mise en garde dans l’email n°1

- **Contexte :** demande de l’utilisateur : se protéger des QR codes malveillants (lien piégé, vol de données) au scan et des faux emails d’invitation. Le scanner n’ouvrait déjà aucun lien, mais le serveur acceptait tout texte (≤ 200 caractères, caractères de contrôle compris) et un QR code étranger pouvait partir en file hors ligne.
- **Modifications :** `validation.est_qr_token` / `QR_TOKEN_RE` (32 caractères base64 URL, format de `nouveau_qr_token`) ; `services.emarger` répond `CODE_INVALIDE` sans requête en base hors de ce format ; `EmargementRequeteSerializer.validate_qr_token` refuse les caractères de contrôle (400). Navigateur : `schemas.natureQr` + `MESSAGES_QR` ; `ScanPoste.lireQr` (caméra et douchette) affiche localement « QR code non reconnu » (son, vibration, historique, caméra en pause) sans rien envoyer ni mettre en file. Email n°1 : mise en garde (QR réservé à l’accueil, ni paiement ni mot de passe, seul site officiel `site_officiel`). Nouvelle page [sécurité de l’accueil](operations/securite-accueil.md) (consignes aux hôtes, douchettes, affiches, SPF/DKIM/DMARC) ; risque R28 ; R27 mis à jour (site en ligne depuis le 2026-11-05, constat de l’utilisateur).
- **Fichiers concernés :** `backend/apps/noyau/validation.py`, `backend/apps/noyau/services.py`, `backend/apps/noyau/serializers.py`, `backend/apps/noyau/emails.py`, `backend/templates/emails/invitation.html`, `backend/templates/emails/invitation.txt`, `backend/apps/noyau/tests/test_emargement.py`, `backend/apps/noyau/tests/test_emails.py`, `frontend/src/lib/schemas.js`, `frontend/src/features/scan/ScanPoste.jsx`, `frontend/tests/schemas.test.js`, `frontend/e2e/parcours.spec.js`, pages du wiki (scan, emails, risques, tests, index, nouvelle page d’exploitation)
- **Validation :** `ruff check` / `ruff format --check` OK ; `pytest` 290/290 (MySQL Docker local) ; test de non-régression vérifié en retirant le contrôle (échoue) ; `npm run lint` OK ; `npm test` 81/81 ; `npm run build` OK ; `npm run e2e` 4/4 (Chromium, dont le nouveau test douchette). `/code-review` : 6 remarques — corrigées : retour sonore et pause caméra (écran local au lieu d’un simple message), message répété toutes les 3 s, reconnaissance de l’affiche d’inscription sur le nom d’hôte sans « www. » ni protocole, double appel de `natureQr` ; wiki mis à jour ; `strip()` du service conservé (le service reste la référence pour tout appelant).
- **Décision :** un format inattendu donne `CODE_INVALIDE` (200) et non une erreur 400, pour ne pas bloquer la synchronisation d’une file hors ligne remplie par une version antérieure.
- **Risques ou limites :** non commité, non déployé ; lecture caméra réelle non testée (seule la douchette l’est en E2E) ; rendu de la mise en garde non vérifié dans une vraie messagerie ; réglage des douchettes et SPF/DKIM/DMARC restent à faire par MDE.

## [2026-11-09] sécurité | Suite R28 : test de la vraie caméra, rendu de l’email n°1, constat DNS de `mde.ci`

- **Contexte :** points laissés ouverts par l’entrée précédente (lecture caméra non testée, rendu de la mise en garde non vu, SPF/DKIM/DMARC non vérifiés).
- **Modifications :** test E2E `frontend/e2e/cameraQr.spec.js` : Chromium reçoit une fausse caméra (`--use-file-for-fake-video-capture`) qui filme un QR code piégé (`frontend/e2e/fixtures/qr-lien-piege.mjpeg`, généré avec `qrcode` + Pillow) ; ZXing le lit réellement. Email n°1 rendu et capturé (largeur 420 px) : mise en garde lisible sous le code de secours. DNS public de `mde.ci` lu avec `dig` : SPF invalide (mot `spf1` isolé → `permerror`), DMARC `p=none`, DKIM absent du sélecteur `google._domainkey`, MX `…msv1.invalid.` résiduel — consigné dans [sécurité de l’accueil](operations/securite-accueil.md) et R28. Pages revérifiées : endpoints, hors-ligne, exigences fonctionnelles (EF-07) et non fonctionnelles (ENF-S7), stratégie et cas de test, composants.
- **Fichiers concernés :** `frontend/e2e/cameraQr.spec.js`, `frontend/e2e/fixtures/qr-lien-piege.mjpeg`, `Cerveau/operations/securite-accueil.md`, `Cerveau/project/risques-et-dette.md`, `Cerveau/api/endpoints.md`, `Cerveau/features/hors-ligne.md`, `Cerveau/specifications/functional-requirements.md`, `Cerveau/specifications/non-functional-requirements.md`, `Cerveau/testing/test-strategy.md`, `Cerveau/testing/test-cases.md`, `Cerveau/architecture/components.md`
- **Validation :** `ruff` OK ; `pytest` 290 passed (MySQL Docker) ; `npm run lint` OK ; Vitest 81/81 ; build OK ; Playwright 5/5 (accessibilité, parcours, temps réel, douchette, caméra).
- **Risques ou limites :** correction DNS (SPF, DKIM, DMARC) hors dépôt, à faire par l’administrateur de `mde.ci` ; le lien entre le SPF invalide et les emails non reçus du 2026-11-06 reste une hypothèse ; caméra testée dans Chromium de bureau seulement (pas sur un vrai téléphone).

## [2026-11-09] documentation | /wiki-maj : 23 pages revérifiées sur `ebaf617`

- **Contexte :** après `f0eaa1f` et `ebaf617`, `lint_wiki.py` signalait 23 pages dont des fichiers sources avaient changé.
- **Modifications :** diff relu (`git diff 107d1f8..ebaf617`) : les pages réellement touchées (scan, hors-ligne, emails, endpoints, exigences, tests, composants, risques, sécurité de l’accueil) avaient été mises à jour dans `ebaf617` ; les autres (ADR-004/005/008/010/011, inscription, sondage, données personnelles, configuration, intégrations, déploiements) ne décrivent rien de modifié : seuls `verifie` et `commit` changent.
- **Fichiers concernés :** frontmatter des 23 pages signalées, `Cerveau/index.md`
- **Validation :** `python3 Cerveau/outils/lint_wiki.py` : 53 pages, 0 erreur, 0 page à revérifier, 0 avertissement.
- **Risques ou limites :** aucun.

## [2026-11-09] fonctionnalité | Robustesse : délai SMTP, délai de frappe de la recherche du scan, garde contre les N+1

- **Contexte :** tri d’une liste générique de conseils de performance ; trois points retenus comme utiles et non faits.
- **Modifications :**
  - `EMAIL_TIMEOUT` (15 s, variable d’environnement, `.env.example`) : sans lui, un SMTP qui accepte la connexion sans répondre bloquait indéfiniment l’email de test (envoyé dans la requête), l’envoi sans file (sans Redis) et un worker jusqu’à sa limite de 120 s.
  - Recherche du scan et de la borne : `lib/useValeurDifferee` (300 ms, effacement immédiat), « Recherche… » pendant l’attente. Avant : une requête par lettre, la borne (30 recherches/min) pouvait se bloquer avec quelques invités à la suite.
  - `test_requetes.py` : 27 pages + recherche de la borne mesurées avec 3 puis 23 invités. **Aucun N+1 trouvé** dans le code actuel ; le test sert de garde (vérifié en retirant un `select_related` : échec).
  - E2E : projet `setup` (`auth.setup.js`) qui enregistre une session admin réutilisée par `sessionAdmin.spec.js` et `cameraQr.spec.js` ; la suite dépassait sinon la limite serveur de 5 connexions/min par compte (échecs « Trop de tentatives »), limite laissée intacte. Test temps réel déplacé (inscription faite depuis un contexte sans session).
- **Fichiers concernés :** `backend/config/settings.py`, `.env.example`, `.gitignore`, `backend/apps/noyau/tests/test_suivi_emails.py`, `backend/apps/noyau/tests/test_requetes.py`, `frontend/src/lib/useValeurDifferee.js`, `frontend/src/features/scan/ScanPoste.jsx`, `frontend/tests/valeurDifferee.test.jsx`, `frontend/playwright.config.js`, `frontend/e2e/auth.setup.js`, `frontend/e2e/sessionAdmin.spec.js`, `frontend/e2e/parcours.spec.js`, `frontend/e2e/cameraQr.spec.js`, pages du wiki (intégrations, déploiement Infomaniak, exigences non fonctionnelles, scan, tests)
- **Validation :** `ruff` OK ; `pytest` 294 passed (MySQL Docker) ; `npm run lint` OK ; Vitest 83/83 ; build OK ; Playwright 7/7, deux exécutions de suite.
- **Risques ou limites :** N+1 non mesurés dans les tâches Celery (actions groupées, relances, sondage, anonymisation) ; `EMAIL_TIMEOUT` s’applique à chaque échange SMTP, pas à l’envoi complet (borné par la limite Celery de 90/120 s) ; non déployé.

## [2026-11-09] documentation | /wiki-maj : 28 pages revérifiées sur `c72f9ba`

- **Contexte :** `c72f9ba` touche des fichiers cités par 28 pages (`backend/config/settings.py`, `ScanPoste.jsx`, dossiers de tests).
- **Modifications :** diff relu : seuls `EMAIL_TIMEOUT` (intégrations, exigences non fonctionnelles, déploiement Infomaniak), le délai de frappe (scan) et les tests (stratégie, cas de test) changent le contenu documenté, mis à jour dans `c72f9ba` ; pour les autres pages, seuls `verifie` et `commit` changent.
- **Fichiers concernés :** frontmatter des 28 pages signalées
- **Validation :** `python3 Cerveau/outils/lint_wiki.py` : 0 erreur, 0 page à revérifier, 0 avertissement.
- **Risques ou limites :** aucun.

## [2026-11-09] déploiement | Mise en ligne Vercel de `f76e789`

- **Contexte :** « push et deploie sur vercel ».
- **Modifications :** 5 commits poussés sur `main` (`9c6a8ba..f76e789`) ; frontend `flex-checking` redéployé au push (Production, « Ready ») ; backend `flex-checking-api` : `vercel deploy --prod` refusé (« Not authorized ») sans équipe, puis accepté avec `--scope mde-it` (« Ready », alias `https://flex-checking-api.vercel.app`). Aucune migration.
- **Validation :** `/api/sante/` 200 (6,5 s : démarrage à froid), `/api/auth/csrf/` 204, frontend 200.
- **Risques ou limites :** VPS `inscription.mde.ci` non mis à jour (mise à jour manuelle sur le serveur).

## [2026-11-09] sécurité | JWT : méthode de signature imposée, clé propre, émetteur et destinataire exigés

- **Contexte :** demande : sécuriser la signature des jetons et interdire la modification de la méthode de chiffrement.
- **Constat avant :** déjà sûr par défaut (SimpleJWT vérifie avec `algorithms=[HS256]`, aucun décodage sans signature dans le code) mais implicite, non prouvé ; clé = `DJANGO_SECRET_KEY` ; pas de `iss`/`aud`.
- **Modifications :** `SIMPLE_JWT` explicite (`ALGORITHM` HS256, `SIGNING_KEY` = `JWT_SIGNING_KEY` ou HMAC du secret Django, `ISSUER`, `AUDIENCE`, `LEEWAY` 0, `JWK_URL` nul) ; contrôle de longueur hors développement ; `.env.example`. Payload laissé signé non chiffré (JWE non retenu : non pris en charge par SimpleJWT, aucune donnée sensible, cookie httpOnly) — contenu vérifié par test.
- **Fichiers concernés :** `backend/config/settings.py`, `.env.example`, `backend/apps/noyau/tests/test_jwt.py`, wiki (authentification, ADR-002, exigences non fonctionnelles, installation, cas de test)
- **Validation :** `ruff` OK ; `pytest` 302 passed (dont 8 de `test_jwt.py`) ; retirer le durcissement fait échouer 4 tests ; `npm run e2e` 7/7.
- **Risques ou limites :** au déploiement, toutes les sessions ouvertes sont refusées une fois (reconnexion des comptes et des bornes) : à éviter un jour de cérémonie. Non commité, non déployé.

## [2026-11-09] documentation | /wiki-maj : pages revérifiées sur `57b619d`

- **Contexte :** `57b619d` modifie `backend/config/settings.py` et ajoute `test_jwt.py`, cités par plusieurs pages.
- **Modifications :** diff relu : seul le bloc `SIMPLE_JWT` change le contenu documenté (authentification, ADR-002, exigences, installation, cas de test, mis à jour dans `57b619d`) ; pour les autres pages, seuls `verifie` et `commit` changent.
- **Fichiers concernés :** frontmatter des pages signalées
- **Validation :** `python3 Cerveau/outils/lint_wiki.py` : 0 erreur, 0 page à revérifier.
- **Risques ou limites :** aucun.

## [2026-11-09] déploiement | Mise en ligne Vercel du durcissement JWT (`57b619d`)

- **Contexte :** accord de l’utilisateur pour commiter, pousser et déployer, reconnexion unique acceptée.
- **Modifications :** `57b619d` et la revérification du wiki poussés (`f76e789..e5c24d1`) ; frontend `flex-checking` redéployé au push (« Ready ») ; backend `flex-checking-api` par `vercel deploy --prod --scope mde-it` (« Ready »).
- **Validation :** en ligne : `/api/sante/` 200 ; `/api/auth/moi/` avec un jeton `alg: none` → 401 ; frontend `/connexion` 200. Connexion réelle non testée en ligne (mot de passe des comptes en ligne non utilisé).
- **Risques ou limites :** toutes les sessions Vercel ouvertes avant le déploiement sont refusées une fois ; VPS `inscription.mde.ci` non mis à jour.

## [2026-11-09] sécurité | Jetons de rafraîchissement jamais stockés en clair, purge, masquage des JWT

- **Contexte :** question de l’utilisateur (« as-tu bien vérifié ce que pourrait présenter le JWT ? ») : revue de tous les endroits où le jeton passe. Cookies, corps de réponse, stockage navigateur, WebSocket et journaux : sains. Faille trouvée : SimpleJWT stocke chaque jeton de rafraîchissement en entier dans `token_blacklist_outstandingtoken.token`, et ce texte rafraîchissait une session (test : 204) — risque R29.
- **Modifications :** `apps/comptes/jetons.py` (signal `pre_save` qui vide le texte, `purger_jetons`) branché dans `ComptesConfig.ready` ; purge dans `tasks.purger` (horaire) et `CronSondagesView` (clé `jetons`) ; `logs.JWT_RE` / `masquer_jetons` et `erreurs.masquer` masquent les JWT ; tests ajoutés à `test_jwt.py` (13 au total) ; `test_sondage.test_cron_protege_par_le_secret` attend la clé `jetons`.
- **Fichiers concernés :** `backend/apps/comptes/jetons.py`, `backend/apps/comptes/apps.py`, `backend/apps/noyau/tasks.py`, `backend/apps/noyau/vues_sondage.py`, `backend/apps/noyau/logs.py`, `backend/apps/noyau/erreurs.py`, `backend/apps/noyau/tests/test_jwt.py`, `backend/apps/noyau/tests/test_sondage.py`, wiki (authentification, risques R29, exigences, cas de test, index)
- **Validation :** `ruff` OK ; `pytest` 307 passed ; signal retiré → `test_jeton_de_rafraichissement_jamais_stocke_en_base` échoue ; Vitest 83/83 ; Playwright 7/7.
- **Risques ou limites :** aucune reconnexion nécessaire ; sur Vercel, les textes déjà enregistrés sont vidés au prochain cron ; aucune migration (le champ reste, vide).

## [2026-11-09] documentation | /wiki-maj : 20 pages revérifiées sur `021396e`

- **Contexte :** `021396e` touche des fichiers cités par 20 pages (tâches, logs, erreurs, vues du sondage, tests).
- **Modifications :** diff relu : le contenu documenté change seulement pour l’authentification, les risques (R29), les exigences et les cas de test, mis à jour dans `021396e` ; pour les autres pages, seuls `verifie` et `commit` changent.
- **Fichiers concernés :** frontmatter des pages signalées
- **Validation :** `python3 Cerveau/outils/lint_wiki.py` : 0 erreur, 0 page à revérifier.
- **Risques ou limites :** aucun.

## [2026-11-09] sécurité | Évaluation OWASP / ASVS et corrections (R30), double authentification reportée

- **Contexte :** évaluation demandée « en se référant aux standards mondiaux » ([analyse](analyses/evaluation-securite-2026-11-09.md)), puis « corrige, laisse d’abord la double authentification ».
- **Modifications :** DRF 3.17.2 → 3.18.2 (3 CVE) ; Daphne déplacé dans `requirements-dev.txt` et chargé seulement s’il est installé (Twisted et Autobahn, 9 CVE, hors production) ; CI : `pip-audit -r requirements.txt` et `npm audit --omit=dev --audit-level=high` bloquants, venv E2E en `requirements-dev.txt` (sinon plus de WebSocket au runserver) ; `.github/dependabot.yml` ; `comptes.views._connexion_refusee` (journal `CONNEXION_ECHEC` / `CONNEXION_BLOQUEE`, logger `securite`, sans email) ; `noyau.alertes` + tâche `envoyer_alerte` (blocage de compte, nouvelle erreur hors navigateur, 1 par clé/h, 10/h, aucune boucle) ; `comptes.validateurs.MotDePasseNonCompromis` (Pwned Passwords, k-anonymat, délai 3 s, panne → accepté) ; `JournalSerializer.get_auteur_nom` : « Tentative de connexion ».
- **Fichiers concernés :** `backend/requirements.txt`, `backend/requirements-dev.txt`, `backend/config/settings.py`, `backend/config/settings_test.py`, `backend/apps/comptes/views.py`, `backend/apps/comptes/validateurs.py`, `backend/apps/noyau/alertes.py`, `backend/apps/noyau/tasks.py`, `backend/apps/noyau/erreurs.py`, `backend/apps/noyau/journal.py`, `backend/apps/noyau/journal_texte.py`, `backend/apps/noyau/serializers.py`, `backend/apps/noyau/tests/test_securite_comptes.py`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, wiki (analyse, R30, authentification, erreurs techniques, intégrations, exigences, installation, tests, index)
- **Validation :** `ruff` OK ; `pytest` 317 passed ; Vitest 83/83 ; build OK ; Playwright 7/7 ; `pip-audit` sur les dépendances de production : aucune vulnérabilité ; `npm audit` : 0 ; démarrage simulé sans Daphne (`check --deploy`, ASGI) ; appel réel à Pwned Passwords vérifié. CI GitHub non encore exécutée sur ces changements.
- **Risques ou limites :** appel HTTPS sortant nécessaire depuis le VPS et Vercel (sinon contrôle sauté, journalisé) ; les alertes dépendent du SMTP (SPF de `mde.ci` invalide, R28) ; MFA non faite ; non commité, non déployé.

## [2026-11-09] documentation | /wiki-maj : 30 pages revérifiées sur `f55527e`

- **Contexte :** `f55527e` touche des fichiers cités par 30 pages (réglages, vues des comptes, erreurs, tâches, journal, CI).
- **Modifications :** diff relu : le contenu documenté change pour l’authentification, les erreurs techniques, les intégrations, les exigences, l’installation, les tests, les risques (R30) et l’analyse, mis à jour dans `f55527e` ; pour les autres pages, seuls `verifie` et `commit` changent.
- **Fichiers concernés :** frontmatter des pages signalées
- **Validation :** `python3 Cerveau/outils/lint_wiki.py` : 0 erreur, 0 page à revérifier.
- **Risques ou limites :** aucun.

## [2026-11-09] déploiement | Backend Vercel : corrections de sécurité R30 (`f55527e`)

- **Contexte :** « déploie le backend sur vercel ».
- **Modifications :** `flex-checking-api` déployé par `vercel deploy --prod --scope mde-it` depuis `backend/` (« Ready », alias `https://flex-checking-api.vercel.app`) ; frontend déjà redéployé au push de `f739344`. Aucune migration.
- **Validation :** en ligne : `/api/sante/` 200, `/api/auth/csrf/` 204, connexion avec un compte inconnu → 401 `IDENTIFIANTS_INVALIDES` (chemin de journalisation des échecs exécuté sans erreur serveur), `/api/auth/moi/` sans session → 401. Alertes email et contrôle Pwned Passwords non déclenchés en ligne.
- **Risques ou limites :** VPS `inscription.mde.ci` non mis à jour ; résultat de la CI GitHub non consulté (`gh` absent du poste).

## [2026-11-09] correction | Dependabot : versions majeures exclues, ESLint groupé

- **Contexte :** aperçu Vercel en échec sur la branche `dependabot/npm_and_yarn/frontend/eslint/js-10.0.1` (`npm install` code 1) : `@eslint/js` 10.0.1 exige `eslint` ^10 (peerDependencies), le projet est en `eslint` 9.39. `main` et la production non touchés. Dependabot avait aussi ouvert des montées majeures (Django 6.1, django-filter 26, django-redis 7, gunicorn 26, Tailwind 4, Vite 8, eslint-plugin-react-hooks 7).
- **Modifications :** `.github/dependabot.yml` : `version-update:semver-major` ignoré pour pip et npm (migrations à planifier) ; groupe `eslint` (`eslint`, `eslint-*`, `@eslint/*`) pour des montées cohérentes.
- **Fichiers concernés :** `.github/dependabot.yml`, `Cerveau/testing/test-strategy.md`
- **Validation :** YAML relu par `yaml.safe_load` ; cause vérifiée par `npm view @eslint/js@10.0.1 peerDependencies`.
- **Risques ou limites :** les pull requests majeures déjà ouvertes restent ouvertes (à fermer dans GitHub) ; une faille dans une version majeure reste signalée par `pip-audit` / `npm audit` en CI. Non commité.

## [2026-11-09] fonctionnalité | Suivi des emails : « Invités à contacter », test et aperçu repliés

- **Contexte :** l’utilisateur juge l’écran peu utile (« voir les mails et envoyer des tests ») ; choix : « Invités à contacter » et « garder le test discret » (la piste « officielles » est abandonnée par l’utilisateur).
- **Modifications :** `suivi_emails.a_contacter` (clé `aContacter` : invitation jamais envoyée, échec avec cause lue dans l’erreur SMTP et côté adresse / envoi, envoi bloqué > 15 min, adresse probablement mal tapée) et `cause_echec` ; `adresses.suggerer_correction` ; `SuiviEmails.jsx` : section « Invités à contacter » en tête (cause, téléphone `tel:`, « Corriger et renvoyer », « Corriger l’adresse », « Renvoyer », bandeau quand le serveur d’envoi est en cause, « Aucun invité à contacter »), cartes allégées (un bandeau d’échecs + renvoi groupé), aperçu et test dans un volet replié, note « Envoyés = accepté par le serveur d’envoi ». Aucun nouveau point d’accès : `PATCH invites/<id>/` et `POST invites/<id>/renvoi-email/` existants.
- **Fichiers concernés :** `backend/apps/noyau/suivi_emails.py`, `backend/apps/noyau/adresses.py`, `backend/apps/noyau/tests/test_a_contacter.py`, `frontend/src/features/admin/SuiviEmails.jsx`, `frontend/tests/suiviEmails.test.jsx`, wiki (tableau de bord A7, emails, API, composants, cas de test)
- **Validation :** `ruff` OK ; `pytest` 347 passed (dont 30 de `test_a_contacter.py` ; le garde N+1 a d’abord repéré 8 → 28 requêtes, corrigé par `only(… evenement_id …)`) ; Vitest 86/86 ; build OK ; relecture du 2026-11-09 : « Corriger et renvoyer » renvoie désormais l’email en échec (magazine d’un invité présent) au lieu de toujours l’invitation, test ajouté, Vitest 87/87, `pytest` 347 passed, lint et build relancés OK ; Playwright 7/7 (accessibilité comprise) ; vérifié dans Chromium sur la base de démonstration locale (bureau 1440 px et mobile 390 px) ; « Corriger et renvoyer » cliqué en vrai : adresse corrigée, invitation repartie, journal `INVITE_MODIFICATION` + `EMAIL_RENVOI`.
- **Risques ou limites :** une adresse acceptée puis abandonnée par le destinataire (rebond différé) n’est connue que si elle ressemble à une faute de frappe : l’application ne reçoit pas les rebonds. Base de démonstration locale modifiée pour la vérification (2 échecs ajoutés sur la Graduation PMD 2026) : `seed_demo` la réinitialise. Non commité.

## [2026-11-09] fonctionnalité | Corrections : inscription directe, ouverture jusqu’au jour J, emails n°1 et n°2, agenda

- **Contexte :** six corrections demandées par l’utilisateur (conversation interrompue avant toute modification, reprise ici). Réponses de l’utilisateur : « 12h30 → 14h30 » est une erreur de saisie de l’heure de la cérémonie (à corriger dans l’écran Cérémonies, pas de code) ; carte d’invitation fournie par **lien** ; brochure par défaut `https://mde.ci`.
- **Modifications :** guide « Comment ça se passe ? » replié au-dessus du formulaire, formulaire affiché directement (`Presentation.jsx`, `InscriptionPage.jsx`) ; inscriptions ouvertes jusqu’au jour de la cérémonie inclus (`services.etat_inscriptions`), date limite retirée du formulaire SA5 et alignée sur `date` ; email n°1 compact, « À très bientôt ! » en bas, signature « MDE Business School » retirée du modèle par défaut ; logo et icônes servis par lien, seules pièces jointes QR code + .ics ([ADR-015](decisions/ADR-015-images-email-par-lien.md)) ; email n°2 à deux boutons (magazine de la cérémonie, brochure Executive Education) ; liens `lien_magazine`, `lien_brochure`, `lien_carte_invitation` saisis à la création de la cérémonie, `Parametres.lien_brochure_defaut` ; agenda : titre « Cérémonie de Graduation {programme} {année} », rappels la veille et une heure avant, carte d’invitation en `ATTACH` et dans la description. Migration `0012_liens_ceremonie` (colonnes avec `db_default`, textes par défaut remplacés seulement s’ils n’avaient pas été personnalisés, date limite alignée).
- **Fichiers concernés :** `backend/apps/noyau/{models,services,serializers,emails,ics,icones_email,suivi_emails,vues_public,urls}.py`, `backend/apps/noyau/migrations/0012_liens_ceremonie.py`, `backend/templates/emails/{base,invitation,magazine}.html`, `magazine.txt`, tests `test_corrections_invitation.py` (17), `test_inscription.py`, `test_super_admin.py`, `test_emails.py` ; `frontend/src/features/invite/{Presentation,InscriptionPage,EtatCarte}.jsx`, `frontend/src/features/super/{Evenements,Parametres,Programmes}.jsx`, `frontend/src/lib/agenda.js`, `frontend/tests/agenda.test.js`, `frontend/e2e/parcours.spec.js` ; wiki (inscription, emails, configuration super admin, modèle de données, API, exigences, cas de test, ADR-015).
- **Validation :** `ruff` OK ; `makemigrations --check` : aucune modification ; `pytest` 366 passed ; Vitest 87/87 ; lint et build OK ; Playwright 7/7 (accessibilité comprise) ; emails rendus et mesurés dans Chromium à 390 px : n°1, formule de fin à 715 px (avant : 920 px).
- **Risques ou limites :** le lien Google Agenda n’accepte ni rappel ni pièce jointe (seul le .ics les porte ; Google applique ses rappels par défaut) ; images distantes bloquées par certaines messageries (Outlook de bureau) : logo remplacé par son texte ; la colonne `date_limite_inscription` reste à supprimer dans une version ultérieure (ADR-014) ; heure 12h30 à corriger en production dans l’écran Cérémonies. Non commité.

## [2026-11-09] correction | Revue de code (/code-review) : 10 points corrigés

- **Contexte :** « /code-review et corrige, test, commit et déploie » sur l’ensemble non commité (« Invités à contacter » + corrections du jour).
- **Modifications :** causes d’échec SMTP réordonnées (notre côté d’abord : expéditeur 5.1.7/5.1.8, authentification, filtrage 5.7.x, taille 5.3.4 ; plus de `552` ni de « rejected » seuls) ; suggestions d’adresse : domaines nationaux des grands fournisseurs (hotmail.be, yahoo.es, aol.fr…) jamais corrigés, mde.ci seulement sur l’extension ; invités ajoutés exprès sans invitation exclus de « jamais envoyée » ; `causesEnvoi` compte les invités (jamais envoyée et bloquée comprises) ; `listeEchecs` retirée de `suivi-emails` (données personnelles jamais affichées) ; « Corriger et renvoyer » recharge l’écran même en cas d’échec du renvoi, pas de renvoi d’un envoi seulement en file ; images des emails : limite de débit propre `images_email`, couleurs restreintes à celles des programmes, logo nommé avec l’empreinte du fichier ; validation des liens des deux côtés (`validation.valider_lien`, `schemas.schemaLien`, http(s) seulement).
- **Fichiers concernés :** `backend/apps/noyau/{suivi_emails,adresses,vues_public,emails,validation,serializers}.py`, `backend/config/settings.py`, tests `test_a_contacter.py`, `test_suivi_emails.py`, `test_corrections_invitation.py` ; `frontend/src/features/admin/SuiviEmails.jsx`, `frontend/src/features/super/{Evenements,Parametres}.jsx`, `frontend/src/lib/schemas.js`, tests `suiviEmails.test.jsx`, `schemaLien.test.js` ; wiki (tableau de bord, API, ADR-015).
- **Validation :** `ruff` OK ; `makemigrations --check` OK ; `pytest` 385 passed ; Vitest 99/99 ; lint et build OK ; Playwright 7/7.
- **Risques ou limites :** liste des extensions nationales finie (`adresses.EXTENSIONS_REELLES`) : un domaine national absent peut encore recevoir une suggestion, jamais appliquée sans clic ; couleurs d’icônes mises en cache 60 s (icônes d’un nouveau programme disponibles sous une minute).

## [2026-11-09] déploiement | Vercel : invités à contacter, corrections du jour, revue de code (`8d7753a`)

- **Contexte :** « /code-review et corrige test commit et deploie », puis autorisation explicite de l’utilisateur pour récupérer les variables Vercel.
- **Modifications :** `8d7753a` poussé sur `main` (frontend `flex-checking` redéployé au push, « Ready ») ; migration `0012_liens_ceremonie` appliquée à la base Neon avec l’URL non poolée (`vercel env pull` dans un fichier privé hors dépôt, supprimé aussitôt) **avant** le code ; backend `flex-checking-api` déployé par `vercel deploy --prod --scope mde-it` (« Ready »).
- **Validation :** en ligne : `/api/sante/` 200 ; `/api/public/emails/images/ic-check-18794E.png` 200 (`image/png`, `Cache-Control: public, max-age=31536000, immutable`) ; couleur inconnue 404 ; `/api/auth/moi/` sans session 401 ; frontend 200 et proxy `/api` 200. Emails n°1 et n°2 non envoyés en ligne.
- **Risques ou limites :** VPS `inscription.mde.ci` non mis à jour (la migration s’y appliquera à la mise à jour) ; heure 12h30 → 14h30 à corriger dans l’écran Cérémonies.

## [2026-11-09] fonctionnalité | Email n°1 en « billet d’entrée », centré et justifié

- **Contexte :** capture de l’email n°1 en ligne : « mail mal organisé, justifie et centre », puis « les autres formats de mail sont bien mais le premier […] n’est pas très intéressant ».
- **Modifications :** `invitation.html` refait en billet (bandeau programme, QR encadré, pastille du code, pointillés, infos centrées, boutons) ; salutation centrée, message justifié, formule de fin centrée ; en-tête centré pour le seul email n°1 (`emails.rendre` : `entete_centre`, `base.html`). Emails n°2 et n°3 inchangés (modification essayée puis annulée à la demande).
- **Fichiers concernés :** `backend/templates/emails/invitation.html`, `backend/templates/emails/base.html`, `backend/apps/noyau/emails.py`, `Cerveau/features/emails.md`
- **Validation :** `ruff` OK ; `pytest` 385 passed ; rendu Chromium à 390 px (PMD, AMP) et 700 px : formule de fin à 746 px.
- **Risques ou limites :** rendu non vérifié dans Outlook de bureau (coins arrondis et pointillés ignorés, sans gêne de lecture). Non commité.

## [2026-11-09] déploiement | VPS `inscription.mde.ci` mis à jour (`99845cd`)

- **Contexte :** « aide-moi à faire la mise à jour sur le VPS » ; script lancé par l’utilisateur sur le serveur.
- **Modifications :** `infra/vps/mettre-a-jour.sh` → « ✓ Mise à jour terminée (version 99845cd) » (migration `0012_liens_ceremonie` appliquée par le service `migrate` avant Django).
- **Validation :** depuis le poste : site 200, `/api/sante/` 200, `/api/public/emails/images/ic-check-18794E.png` 200, couleur inconnue 404, `/api/auth/moi/` sans session 401. Email de test non vérifié par l’agent.
- **Risques ou limites :** sauvegardes automatiques peut-être toujours non activées (`sudo infra/vps/activer-sauvegardes.sh`) ; heure 12h30 → 14h30 à corriger dans l’écran Cérémonies.

## [2026-11-09] fonctionnalité | Carte d’invitation : fichier téléversé au lieu d’un lien

- **Contexte :** capture du formulaire SA5 « Lien de la carte d’invitation du programme » : « c’est un fichier, pas un lien ».
- **Modifications :** modèle `CarteInvitation` (migration `0013`, table à part) ; `cartes_invitation.preparer` (base64, JPEG / PNG / PDF reconnus au contenu, images réencodées, 1,8 Mo, nom nettoyé) ; `PUT`/`DELETE evenements/<id>/carte-invitation/` (super admin, journal `CARTE_INVITATION_AJOUT` / `_SUPPRESSION`) ; `GET public/evenements/<slug>/carte-invitation/` ; .ics `ATTACH;FMTTYPE=…` et description vers ce fichier (ancien lien en repli) ; `carteInvitation` dans la cérémonie (métadonnées seules) ; SA5 : champ fichier « Choisir / Remplacer le fichier », « Retirer la carte », réduction des images lourdes (`lib/carteInvitation.js`) ; `api.put`. [ADR-016](decisions/ADR-016-carte-invitation-en-base.md).
- **Fichiers concernés :** `backend/apps/noyau/{cartes_invitation,models,serializers,vues_admin,vues_public,urls,ics,journal,journal_texte}.py`, `backend/apps/noyau/migrations/0013_carte_invitation.py`, `backend/apps/noyau/tests/test_carte_invitation.py` (12) ; `frontend/src/lib/{carteInvitation,api}.js`, `frontend/src/features/super/Evenements.jsx`, `frontend/tests/carteInvitation.test.js`, `frontend/e2e/carteInvitation.spec.js` ; wiki (emails, configuration super admin, modèle de données, API, ADR-016).
- **Validation :** `ruff` OK ; `makemigrations --check` OK ; `pytest` 397 passed ; Vitest 102/102 ; lint et build OK ; Playwright 8/8 (dont le nouveau parcours : envoi d’une image, `ATTACH` dans le .ics, retrait) ; écran SA5 capturé dans Chromium.
- **Risques ou limites :** 1,8 Mo au plus ; Google Agenda (lien web) n’affiche pas la pièce jointe, seule l’adresse dans la description ; sur le VPS, la CSP globale de Caddy peut remplacer l’en-tête `sandbox` de Django (à vérifier en ligne ; CSP stricte de toute façon). Migration `0013` à appliquer sur Neon et sur le VPS. Non commité.

## [2026-11-09] sécurité | Revue de code (8 points), contrôle des règles de sécurité en ligne, en-têtes de l’API

- **Contexte :** « fais un /code-review, teste et corrige ; vérifie si toutes nos règles de sécurité du début du projet à aujourd’hui fonctionnent ; corrige mais ne casse rien ».
- **Modifications (revue) :** ancien lien de carte affiché et effacé à l’envoi ou au retrait d’un fichier (il revenait dans l’agenda), interface sans champ caché ; photos redressées selon l’EXIF, profil de couleurs gardé, 2400 px au plus, réduction de qualité ou PNG → JPEG pour tenir dans 1,8 Mo (le serveur refusait des fichiers acceptés par l’interface) ; même limite de pixels côté navigateur ; PDF téléchargé au lieu d’être bloqué par `sandbox` ; signal temps réel `CarteInvitation` (cache public vidé, écrans à jour) ; une seule requête de carte par .ics ; `ETag` / 304 et `no-cache` ; liste unique des formats (`cartes_invitation.TYPES`).
- **Contrôle des règles (ENF-S1 à S16) :** 111 tests de sécurité du dépôt OK (`test_securite*`, `test_audit_securite`, `test_durcissement`, `test_jwt`, `test_donnees_personnelles`, `test_borne*`) ; `npm audit --omit=dev` : 0 vulnérabilité ; `pip-audit` (paquets installés) : seuls Twisted et Autobahn, dépendances de Daphne hors production (ENF-S15) ; contrôle en lecture seule sur `inscription.mde.ci` et `flex-checking.vercel.app` (script de 33 points) : en-têtes CSP / HSTS / nosniff / Referrer / Permissions / COOP / X-Frame présents, API en `no-store`, données et documentation de l’API refusées sans session (401), JWT `alg: none` refusé, CSRF exigé (403), multipart refusé (415), cron sans secret 404, liens et jetons inconnus 404, pages d’erreur sans détail Django, `.env`, `.git`, sources non exposés. **Écart :** `X-Frame-Options: SAMEORIGIN` et CSP du site imposés à l’API par Caddy et `vercel.json` (Django envoie `DENY` et `default-src 'none'`) → `?` (valeur par défaut) dans `infra/Caddyfile.prod`, en-têtes de `frontend/vercel.json` limités aux pages ; comportement de `?` vérifié avec Caddy 2 en local, `caddy validate` OK ; aucun cadre de l’application ne charge `/api` (aperçus en `srcDoc`).
- **Fichiers concernés :** `backend/apps/noyau/{cartes_invitation,ics,models,serializers,temps_reel,vues_admin,vues_public}.py`, `backend/apps/noyau/tests/test_carte_invitation.py` (19), `frontend/src/lib/{carteInvitation,schemas}.js`, `frontend/src/features/super/Evenements.jsx`, `frontend/tests/schemaLien.test.js`, `infra/Caddyfile.prod`, `frontend/vercel.json` ; wiki (ADR-016, API, exigences non fonctionnelles).
- **Validation :** `ruff` OK ; `makemigrations --check` OK ; `pytest` 404 passed ; Vitest 102/102 ; lint et build OK ; Playwright 8/8.
- **Risques ou limites :** limites de débit non éprouvées en ligne (éviter de bloquer l’IP du bureau ; couvertes par les tests) ; en-têtes de l’API à revérifier après déploiement et mise à jour du VPS.
