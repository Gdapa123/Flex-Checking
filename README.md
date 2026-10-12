# Flex’Checking

Application d’émargement des cérémonies de graduation de **MDE Business School** (Abidjan).
Identifiant technique : `flex-checking`.

Quatre espaces :

| Espace | URL | Pour qui |
|---|---|---|
| Invité | `/i/<lien d’inscription>` (+ `/pratique` : agenda et itinéraire) | Public, mobile d’abord, sans compte |
| Scan | `/scan` | Hôtes d’accueil (téléphone, tablette borne, ordinateur + douchette ou webcam) |
| Admin | `/connexion` → `/admin` | Admins des cérémonies (tableau de bord temps réel, invités) |
| Super admin | `/super/connexion` → `/super` | Direction des événements (configuration globale) |

Stack : Django 5 + Django REST Framework, MySQL 8, Celery + Redis · React 18 (JavaScript) + Vite, Tailwind CSS,
TanStack Query / Table, Zod, ZXing, Recharts, PWA.

---

## 1. Démarrage rapide (Docker Compose, HTTPS local)

Prérequis : Docker Desktop, [mkcert](https://github.com/FiloSottile/mkcert).

```bash
cp .env.example .env                 # puis adaptez les valeurs si besoin
./infra/certs.sh                     # certificats HTTPS locaux (mkcert)
docker compose up -d --build         # mysql, redis, mailpit, django, celery, frontend, proxy (Caddy)
docker compose exec django python manage.py seed_demo
```

Ouvrez **https://flex-checking.localhost** (la caméra exige HTTPS hors `localhost`).

Avec Docker Compose, les emails ne partent jamais sur Internet : Django et Celery les remettent à **Mailpit**, qui les
affiche sur http://localhost:8025 (QR code, pièces jointes, rendu mobile). Pour un vrai envoi, renseignez un serveur
SMTP dans `.env` et retirez les variables `EMAIL_*` du bloc `x-backend` de `docker-compose.yml`.

| Service | Rôle | Port hôte |
|---|---|---|
| `mysql` | MySQL 8, utf8mb4 | 3307 |
| `redis` | broker Celery, cache, limitation de débit, relais temps réel | 6380 |
| `mailpit` | boîte mail de test : tous les emails de l’application, **http://localhost:8025** | 8025, 1025 (ce poste seulement) |
| `django` | API (`/api/`), migrations au démarrage | 8000 |
| `celery` | envois d’emails, actions groupées et exports lourds | — |
| `frontend` | Vite (dev) | 5173 |
| `proxy` | Caddy HTTPS : `/api/*` → Django, le reste → Vite | 443, 8443 |

## 2. Développement sans Docker (hors MySQL / Redis)

```bash
docker compose up -d mysql redis

# Backend
cd backend
python3.12 -m venv .venv
PKG_CONFIG_PATH=/opt/homebrew/opt/mysql-client/lib/pkgconfig .venv/bin/pip install -r requirements-dev.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo
CELERY_TASK_ALWAYS_EAGER=1 JWT_COOKIE_SECURE=0 .venv/bin/python manage.py runserver   # :8000
# (ou un vrai worker : .venv/bin/celery -A config worker -l info)

# Frontend
cd frontend
npm install
npm run dev                                                                            # :5173, proxy /api → :8000
```

Ouvrez http://localhost:5173 (la caméra fonctionne sur `localhost` même en HTTP).

## 3. Comptes de démonstration (`seed_demo`) — à changer en production

Aucun mot de passe n’est écrit dans le dépôt. `seed_demo` lit `DEMO_MOT_DE_PASSE_SUPER_ADMIN` et `DEMO_MOT_DE_PASSE_ADMIN` dans `.env` ; si elles sont vides, il génère des mots de passe aléatoires et les affiche une seule fois dans le terminal. Pour appliquer de nouveaux mots de passe à des comptes existants : `python manage.py seed_demo --reinitialiser-mots-de-passe`. Ne lancez jamais `seed_demo` en production.

| Rôle | Email | Mot de passe | Événements |
|---|---|---|---|
| Super admin | direction.evenements@mde.ci | `DEMO_MOT_DE_PASSE_SUPER_ADMIN` | tous |
| Admin | mariam.kone@mde.ci | `DEMO_MOT_DE_PASSE_ADMIN` | AMP et PMD de l’année |
| Admin | kouame.brou@mde.ci | `DEMO_MOT_DE_PASSE_ADMIN` | AMP de l’année |
| Admin | ines.toure@mde.ci | `DEMO_MOT_DE_PASSE_ADMIN` | PMD, Public-AMP, Public-ASD |

Les tests Playwright lisent les mêmes variables (fichier `.env` en local, mots de passe éphémères générés à chaque exécution en CI).

`seed_demo` est idempotent. Il crée :
- **Graduation AMP {année}** le jour même (en cours) : accueil 2 h avant l’heure de lancement, 40 invités dont 24 présents, modes, postes et heures variés, 2 emails en échec ;
- **Graduation PMD {année}** (inscriptions ouvertes, 40 invités), Public-AMP et Public-ASD ;
- les éditions 2025, 2024 et 2023 d’AMP et de PMD pour la comparaison annuelle.

Les statuts (INSCRIT, PRESENT), les quatre programmes et les paramètres sont aussi créés par **data migration** (indispensables en production).

## 4. Variables d’environnement (`.env`, non commité — voir `.env.example`)

| Variable | Rôle |
|---|---|
| `DJANGO_SECRET_KEY` | clé secrète Django : obligatoire hors développement (32 caractères minimum), sinon Django refuse de démarrer |
| `NUM_PROXIES` | nombre de proxys de confiance devant Django (1 avec Caddy) : identifie l’IP réelle pour les limites de débit |
| `DJANGO_DEBUG` | `1` en développement, `0` en production |
| `DJANGO_ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS` | domaines autorisés |
| `APP_PUBLIC_URL` | URL publique (liens des emails, QR d’inscription) |
| `MYSQL_*`, `DB_HOST`, `DB_PORT` | base MySQL |
| `REDIS_URL` | Redis (Celery, cache, limitation de débit) |
| `EMAIL_BACKEND` | `console` en dev, `django.core.mail.backends.smtp.EmailBackend` en production |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` | SMTP |
| `DEFAULT_FROM_EMAIL` | adresse d’envoi (le nom affiché est « Flex’Checking · MDE Business School ») |
| `JWT_ACCESS_MINUTES`, `JWT_REFRESH_HOURS` | durée des jetons |
| `JWT_COOKIE_SECURE` | `1` (défaut) ; `0` seulement en HTTP local hors `localhost` |
| `CELERY_TASK_ALWAYS_EAGER` | `1` pour exécuter les tâches sans worker (dev, tests) |

## 5. Commandes

```bash
# Backend (depuis backend/)
.venv/bin/pytest                          # 79 tests (règles critiques, permissions, emails…)
.venv/bin/ruff check . && .venv/bin/ruff format --check .
.venv/bin/python manage.py seed_demo

# Frontend (depuis frontend/)
npm run build                             # build de production + service worker PWA
npm run lint                              # ESLint + Prettier
npm test                                  # Vitest (tokens partagés avec Python, schémas, formats, composants)
npm run e2e                               # Playwright : parcours complet + audit d’accessibilité axe-core (WCAG 2.1 AA)
```

Le test Playwright démarre son propre Django (port 8001, emails écrits dans `frontend/.emails-e2e/`, Celery
synchrone) et son propre Vite (port 5174) ; MySQL et Redis doivent tourner et `seed_demo` avoir été exécuté.

Intégration continue : `.github/workflows/ci.yml` (GitHub Actions) exécute ces contrôles à chaque envoi sur `main`
et à chaque pull request : backend (ruff + pytest sur MySQL), frontend (lint, Vitest, build), puis Playwright.

Mesures (pile Docker, serveur de dev) : un émargement répond en ~50 ms ; l’email n°2 part en arrière-plan (Celery).

API documentée (OpenAPI) : `/api/docs/` (Swagger) et `/api/schema/`.

## 6. Tester le scan sur un téléphone

1. `./infra/certs.sh <IP-du-poste>` (ex. `./infra/certs.sh 192.168.1.20`) puis `docker compose up -d`.
2. Installez l’autorité mkcert sur le téléphone : fichier `rootCA.pem` (dossier donné par `mkcert -CAROOT`).
   - iOS : AirDrop du fichier, *Réglages → Profil téléchargé → Installer*, puis *Réglages → Général → Informations → Réglages des certificats* : activez la confiance.
   - Android : *Paramètres → Sécurité → Installer un certificat CA*.
3. Ouvrez `https://<IP-du-poste>:8443/scan` sur le téléphone, connectez-vous, choisissez l’événement, le poste et le mode.
4. Ajoutez l’application à l’écran d’accueil (PWA) pour le plein écran.
5. Pour un QR de test : ouvrez la fiche d’un invité dans l’espace admin (QR affiché), ou l’email n°1 reçu (console Django en dev).

Hors ligne : coupez le réseau du téléphone, les passages sont mis en file (IndexedDB) et affichés « Enregistré,
vérification à la reconnexion » ; ils sont synchronisés automatiquement au retour du réseau.

## 7. Production : `docker-compose.prod.yml`

```bash
cd frontend && npm ci && npm run build && cd ..          # fichiers statiques servis par Caddy
docker compose -f docker-compose.prod.yml up -d --build    # mysql, redis, migrate, django, celery, celery-beat, proxy
docker compose -f docker-compose.prod.yml exec django python manage.py shell -c \
  "from apps.comptes.models import Admin; Admin.objects.create_superuser('email', 'Nom', 'mot-de-passe')"
```

`.env` de production : `DJANGO_DEBUG=0`, `DJANGO_SECRET_KEY` (≥ 32 caractères), `DOMAINE`, `APP_PUBLIC_URL` en HTTPS,
`DJANGO_ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, mots de passe MySQL forts, SMTP (`EMAIL_BACKEND` smtp). Ne jamais lancer
`seed_demo` en production.

**Charge (plus de 1 000 personnes simultanées)**

| Élément | Réglage |
|---|---|
| Serveur web | Gunicorn + workers Uvicorn (`backend/gunicorn.conf.py`) : HTTP et WebSocket sur plusieurs processus ; `WEB_CONCURRENCY` (défaut 2 × cœurs). Plus de conteneurs : `--scale django=3`, Caddy répartit (moins de connexions actives) et retire un conteneur en panne (`/api/sante/`). |
| Base | MySQL `max_connections=600`, mémoire InnoDB `MYSQL_INNODB_BUFFER` (défaut 1G) ; index sur les tris et la relance des emails ; une connexion par requête (ASGI) avec délai de connexion de 5 s. |
| Cache Redis (base 1) | statistiques du tableau de bord, page publique d’inscription, analyses : vidés à chaque changement (chiffres toujours exacts). Redis indisponible : lecture en base, sans erreur. |
| File et temps réel (Redis base 0) | `maxmemory-policy volatile-lru` : seules les clés à durée de vie sont évincées, jamais la file des emails. |
| Emails | workers Celery séparés (`CELERY_CONCURRENCY`), 3 nouvelles tentatives, relance automatique des emails restés en attente (Celery beat, toutes les 5 min). |
| Limites de débit | par IP larges (une salle ou un opérateur mobile partage une IP) : 600 req/min anonymes, 60 inscriptions/h ; strictes par compte et par email : connexion 5/min par IP et email, 20/h par compte, renvoi du QR 3/h par email, rapports PDF 30/h. Réglables : `LIMITE_ANONYME`, `LIMITE_INSCRIPTION_IP`, `LIMITE_COMPTE`. |
| Frontend | fichiers versionnés en cache un an (`immutable`), page d’entrée revalidée ; compression zstd/gzip ; la page d’inscription publique pèse ~100 Ko compressés (graphiques chargés seulement dans les espaces admin). |

**Test de charge** (`infra/charge/`, procédure et résultats détaillés) : 1 000 ouvertures simultanées du lien
d’inscription, 500 inscriptions simultanées, 300 tableaux de bord et un scénario mixte de 1 500 requêtes : 100 % de
réussite ; 500 écrans WebSocket notifiés en moins de 0,1 s. Une file d’attente par processus (`config/concurrence.py`,
`DB_CONCURRENCE`) borne les connexions MySQL : au lieu d’échouer, les requêtes en surplus attendent leur tour.

**Résilience (l’utilisateur n’est pas impacté par une panne)**

- File d’emails indisponible : l’inscription ou le scan réussit quand même ; l’email part dès le retour de la file.
- Redis indisponible : pas de cache ni de temps réel, l’application continue (interrogation périodique).
- WebSocket coupé : reconnexion progressive, rechargement des données manquées.
- Scan sans réseau : file locale (IndexedDB), synchronisée au retour du réseau.
- Erreur imprévue : message neutre à l’utilisateur, détail dans **Super admin › Erreurs**.
- Conteneurs redémarrés automatiquement (`restart: unless-stopped`), contrôles de santé MySQL, Redis, Django, Celery.

**Sécurité de l’exploitation**

- Conteneur applicatif sans privilèges (utilisateur `flex`), MySQL et Redis non exposés hors du réseau Docker.
- En-têtes CSP, HSTS, COOP, `Permissions-Policy` ; corps de requête limité à 5 Mo ; documentation de l’API
  (`/api/docs/`) réservée au super admin.
- Dépendances auditées (`pip-audit`, `npm audit`) : aucune vulnérabilité connue en production à la date du dernier audit.

## 8. Architecture

```
backend/
  config/                 settings (variables d’env), urls, celery, asgi (HTTP + WebSocket)
  apps/comptes/           Admin (AUTH_USER_MODEL, Argon2), JWT en cookies httpOnly + CSRF, permissions
  apps/noyau/
    models.py             Programme, Evenement, Statut, Invite, Emargement, EmailEnvoye, JournalActivite, Parametres
    services.py           inscription, émargement atomique et idempotent, annulation
    temps_reel.py         signaux → notifications regroupées, envoyées après commit (Channels + Redis)
    consumers.py          WebSocket /api/ws/ : session par cookie, groupes par événement, aucune donnée personnelle
    emails.py, tasks.py   rendu des emails (HTML + texte, CID, .ics), envoi Celery avec 3 nouvelles tentatives
    theme.py              dérivation des tokens (miroir de frontend/src/theme/tokens.js)
    vues_*.py             API : public, scan, invités, super admin
  templates/emails/       gabarits des emails (tables, 600 px, Gmail / Outlook)
frontend/src/
  theme/                  tokens.js (dérivation), ThemeScope (variables CSS du programme)
  styles/tokens.css       seul fichier contenant des couleurs (univers MDE, programme, graphite, statuts)
  components/ui/          primitives du design system
  lib/tempsReel.js        connexion WebSocket unique, reconnexion, rechargement ciblé des requêtes
  features/invite|scan|admin|invites|super|auth
shared/token-fixtures.json  cas de référence communs aux tests JS et Python
design-source/            maquettes Claude Design (référence, non déployées)
```

## 9. Choix et interprétations

Les contradictions entre le design et le cahier des charges sont listées dans `PLAN.md` (section 7). Choix complémentaires :

- **Temps réel** : WebSocket `/api/ws/` (Django Channels, relais Redis). Chaque changement (inscription, scan,
  annulation, statut d’email, invité modifié, événement, programme, compte, paramètres, journal) est annoncé après
  commit aux seuls écrans autorisés (un admin ne reçoit que ses événements). Le message ne contient que des sujets
  (« invites », « statistiques »…) : le navigateur recharge par l’API REST, qui applique les droits. Connexion
  authentifiée par le cookie de session, origine vérifiée, fermée à l’expiration du jeton (le navigateur rafraîchit
  la session et se reconnecte) et dès qu’un compte est désactivé. En cas de coupure, les écrans reviennent à
  l’interrogation périodique (5 s pour le tableau de bord, les invités et le scan) et rechargent tout à la
  reconnexion. L’en-tête admin affiche « En direct » ou « Reconnexion… ».
- **Comptes admins** : création par le super admin avec mot de passe temporaire affiché une seule fois, à changer à la
  première connexion (même mécanisme pour la réinitialisation). « Mot de passe oublié ? » affiche la marche à suivre
  (contacter la direction des événements).
- **Rôles** : SUPER_ADMIN et ADMIN uniquement ; l’« Hôte scan » du design est un ADMIN affecté à l’événement.
- **Badges** : « Inscrit·e » (confirmation) et « Présent·e » (email n°2), selon le cahier des charges.
- **Renvoi du QR** : la réponse est toujours identique, qu’une adresse soit inscrite ou non ; 3 renvois par heure et par adresse.
  L’écran « Cette adresse est déjà inscrite » est conservé (exigé), la limitation de débit réduit l’énumération.
- **Modèles d’emails** : le texte avant `{qr_code}` va dans la carte message, `{qr_code}` devient la carte QR + code de
  secours, le texte après dans une carte suivante ; les infos pratiques et les boutons sont toujours ajoutés
  (même principe avec `{lien_magazine}` pour l’email n°2). Aperçu = HTML réel rendu par l’API.
- **Emails** : pas de chevauchement négatif des cartes sur l’en-tête (non supporté par Gmail/Outlook) ; icônes en PNG
  générées côté serveur (le SVG n’est pas affiché par les clients mail) ; l’emplacement « couverture du magazine »
  du design est retiré faute d’image dans le modèle de données.
- **Scan** :
  - disposition détectée automatiquement (téléphone < 640 px, borne tactile, ordinateur), modifiable dans la configuration ;
  - champ « Poste » ajouté à la configuration ;
  - durée, son et vibration : valeur globale (paramètres) modifiable sur l’appareil (Réglages) ;
  - sur la borne libre-service, la recherche exige 3 lettres et masque les emails ;
  - hors ligne, aucune validation locale : tout passage est mis en file et affiché « Enregistré, vérification à la
    reconnexion » (fond avertissement) ; le serveur reste l’arbitre et envoie l’email n°2 à la synchronisation ;
  - une heure client plausible (≤ 12 h) est conservée comme heure de passage d’un scan hors ligne ;
  - la douchette peut aussi saisir un code à 4 chiffres.
- **Tableau des invités** : l’indicateur « Invitations à renvoyer » du design filtre les emails n°1 en échec ; la fiche
  latérale ajoute le QR, le code, un bouton « Modifier » et l’historique complet ; actions groupées et exports
  au-delà de 50 invités traités par Celery (suivi de tâche puis téléchargement).
- **Super admin** : écran « Tous les invités » ajouté ; formulaire d’événement complété (heure d’accueil, lien carte,
  ouverture des inscriptions, régénération du lien avec confirmation) ; éditeur de programme complété (nom, lien
  magazine, activation de l’email n°2, suppression si aucun événement) ; aperçu en direct sur trois supports
  (invité, scan, email).
- **Lien d’inscription** : `amp-2026-x7k2q9` (lisible + 6 caractères aléatoires), régénérable.
- **Écran de présentation** : en ouvrant le lien, l’invité voit d’abord les étapes (inscription et réception du QR
  code et du code, scan le jour de la graduation, réception du lien du magazine si l’email n°2 est actif), puis
  « Commencer mon inscription ».
- **Tri des tableaux d’invités** : menu « Trier par » (inscriptions récentes ou anciennes, nom et prénom de A à Z ou
  de Z à A, entreprise, arrivées récentes ou anciennes, présents ou non présents d’abord, événement pour le super
  admin), synchronisé avec les en-têtes cliquables et l’URL ; le dernier choix est mémorisé sur l’appareil. Seul le
  critère principal change de sens : les égalités restent classées par nom de A à Z.
- **Erreurs techniques** : les interfaces n’affichent jamais de détail technique (message simple, bouton « Recharger »).
  Les erreurs du navigateur (écran planté, erreur JavaScript), du serveur (réponse 500 neutre), des tâches Celery,
  des envois d’email en échec définitif et du relais temps réel sont enregistrées dans **Super admin › Erreurs**
  (`/super/erreurs`), en temps réel : regroupées par signature avec compteur d’occurrences, détail dépliable
  (trace, navigateur), « Résolue » / « Rouvrir » (une erreur résolue qui revient est rouverte), conservation 30 jours.
  Emails et téléphones sont masqués, les URL sont gardées sans paramètres ; signalement public limité à 30/min.
- **Agenda et itinéraire** : « Ajouter à l’agenda » propose Google Agenda, Apple Calendrier (fichier .ics), Outlook et
  Microsoft 365 (événement pré-rempli, rappel 2 h avant) ; « Enregistrer l’itinéraire » ouvre le trajet dans Google
  Maps, Waze ou Plans, ou copie l’adresse. Apple est proposé en premier sur iPhone et iPad. Les boutons de l’email
  mènent à la page publique `/i/<lien>/pratique` (mêmes choix) ; le fichier .ics reste joint à l’email.
- **Champs obligatoires** : tous les champs du formulaire d’inscription et de l’ajout manuel (entreprise et fonction
  comprises) sont obligatoires, côté client et côté API ; formulaire mobile compacté pour tenir sur un écran.
- **Exports lourds** : le fichier produit par Celery est supprimé dès son téléchargement ; les fichiers oubliés sont purgés après 6 h.
- **CSV** : UTF-8 avec BOM, séparateur « ; » (ouverture directe dans Excel en français).
- **Journal** : aucune donnée personnelle d’invité stockée ; les libellés (noms) sont reconstitués à l’affichage.
- **Logo** : le logo Flex’Checking fourni (monogramme MDE) remplace l’emplacement « LOGO MDE » ; version blanche
  sur les dégradés et le graphite.
