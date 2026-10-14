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
