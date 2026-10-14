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
