# Flex’Checking — PLAN (phase 0)

Application d’émargement des cérémonies de graduation de MDE Business School.
Identifiant technique : `flex-checking`. Stack imposée : Django 5 + DRF, React 18 (JS) + Vite, MySQL 8.

Source du design : projet Claude Design `90947bde-ee2e-419b-aa1c-5a1339b40b81`, copié en lecture seule dans
`design-source/`. Ce dossier sert de référence et ne part pas en production.

---

## 1. Fichiers du design

| Fichier | Rôle | Statut |
|---|---|---|
| `Invite.dc.html` | Inscription invité : formulaire, erreurs, confirmation, 4 états | **Référence** |
| `Scan.dc.html` | Scan : téléphone, tablette borne, ordinateur (douchette et webcam) | **Référence** |
| `Admin.dc.html` | Admin : connexion, choix de la cérémonie, tableau de bord, invités, fiche | **Référence** |
| `Super Admin.dc.html` | Super admin, palette MDE | **Référence** |
| `Emails.dc.html` | Email n°1 (invitation) et n°2 (magazine) | **Référence** |
| `Design System.dc.html` | Tokens, statuts, typographie, espacements, rayons, composants | **Référence** |
| `mde.js` | Palettes des programmes, dérivation des tokens, contraste, icônes SVG, faux QR, données factices | Tokens et icônes repris ; faux QR et données factices écartés |
| `support.js` | Runtime de prototypage (moteur `sc-if`/`sc-for`, `style-hover`/`style-active`/`style-focus`, `dc-import`, helmet) | Non embarqué. `style-hover`/`active`/`focus` deviennent les variantes Tailwind `hover:`/`active:`/`focus:` ; `sc-if`/`sc-for` deviennent du JSX |
| `Maquettes.dc.html`, `Explorations.dc.html`, `Accueil.dc.html` | Planche, pistes explorées, page d’accueil du prototype | Contexte seulement (la direction retenue est « 2a ») |
| `* v1.dc.html` | Versions précédentes des écrans | Considérées comme obsolètes et non relues en détail |

Éléments propres au prototype et non repris : la barre noire de développement (sélecteurs de programme, d’écran, d’appareil et de file simulée), la mise à l’échelle des cadres d’appareil, la simulation automatique des passages, le bouton « Simuler une coupure réseau » et le programme inventé EMBA.

Logo : le design affiche un emplacement « LOGO MDE ». Les fichiers fournis contiennent le logo Flex’Checking (monogramme MDE dans un cadre de visée), en version rouge pour les fonds clairs et en version blanche pour les en-têtes en dégradé et le graphite. Ils seront convertis en SVG ou PNG optimisés dans `frontend/src/assets/` et `backend/templates/emails/`. Voir la question Q3.

---

## 2. Écrans à produire

### Invité (public, mobile d’abord, couleurs du programme)
| # | Écran | Remarques |
|---|---|---|
| I1 | Inscription | En-tête en dégradé, titre « Graduation {programme} {année} », bandeau Date / Heure / Lieu, formulaire (civilité segmentée, Nom, Prénom, Email, Téléphone +225, Entreprise, Fonction), case de consentement, bouton fixé en bas |
| I2 | Erreurs de saisie | Récapitulatif `role="alert"` focalisé, liens vers chaque champ, erreurs sous les champs, validation à la sortie de chaque champ |
| I3 | Confirmation | Pastille de validation, « Inscription réussie », carte récapitulative avec badge, carte « Votre invitation », boutons Agenda et Itinéraire, lien de renvoi |
| I4 | Inscriptions fermées | Carte d’état (icône cadenas) |
| I5 | Événement complet | Carte d’état (icône utilisateurs) |
| I6 | Date limite dépassée | **Ajout du prompt** : même gabarit que I4, icône horloge |
| I7 | Adresse déjà inscrite | « Renvoyer mon QR code » et « Utiliser une autre adresse » |
| I8 | Lien invalide | Repli sur la palette MDE, lien vers mde.ci |

### Emails (couleurs du programme, 600 px)
| # | Email |
|---|---|
| E1 | Invitation : en-tête, message, carte QR et code de secours, infos pratiques, boutons Agenda (.ics) et Itinéraire, pied de page |
| E2 | Magazine : en-tête « Bienvenue… », badge Présent·e et heure, message, carte magazine, bouton « Lire le magazine » et lien en clair |

### Scan (graphite, plein écran)
| # | Écran |
|---|---|
| S1 | Configuration : choix de l’événement, du poste et du mode, mémorisés sur l’appareil |
| S2 | Téléphone, caméra : en-tête et compteur présents / inscrits, cadre de visée, barre d’outils (Code, Rechercher, Annuler, Torche, Caméra), dernier passage |
| S3 | Détection : cadre vert, « QR code détecté · vérification… » |
| S4 | Résultat plein écran : Présence enregistrée, Déjà émargé, Code invalide, Autre événement. Barre de progression, pause au toucher, `aria-live` |
| S5 | Code à 4 chiffres : 4 cases et pavé numérique, validation au 4e chiffre |
| S6 | Recherche par nom : liste, badge Présent ou bouton « Émarger » (« C’est moi » sur la borne) |
| S7 | Feuille « Annuler le dernier émargement » |
| S8 | Feuille « Réglages du scan » |
| S9 | États de la caméra : autorisation, refus, aucune caméra, caméra occupée (**ajout du prompt**) |
| S10 | Bandeau hors ligne et compteur « en attente de synchronisation » |
| S11 | Tablette borne (paysage) : « Présentez votre QR code », gros boutons Code et Recherche, accès hôte (cadenas) |
| S12 | Ordinateur : douchette (champ invisible toujours focalisé) ou webcam, panneau du résultat, historique « Derniers passages » |

### Admin (desktop, couleurs du programme)
| # | Écran |
|---|---|
| A1 | Connexion |
| A2 | Choix de la cérémonie (cartes avec statut et jauge Inscrits / capacité) |
| A3 | Tableau de bord temps réel : 4 indicateurs, arrivées par tranche de 15 minutes, répartition par mode, suivi des emails et alerte « à renvoyer », comparaison avec les années précédentes |
| A4 | Gestion des invités : indicateurs-filtres, barre de filtres, actions groupées, tableau triable, pagination |
| A5 | Panneau latéral « Fiche invité » : actions, fiche, **QR et code** (ajout du prompt), historique |
| A6 | Panneau latéral « Ajouter un invité » |
| A7 | Emails : aperçu en lecture seule des deux emails du programme (entrée « Emails » de la navigation du design) |

### Super admin (desktop, univers MDE)
| # | Écran |
|---|---|
| SA1 | Connexion (fond bordeaux sombre, badge « Super admin ») |
| SA2 | Vue globale : 4 indicateurs et tableau de tous les événements |
| SA3 | Programmes : liste à gauche, éditeur à droite (couleurs, tokens dérivés, contrastes, aperçu en direct) |
| SA4 | Dialogue de désactivation d’un programme |
| SA5 | Événements : liste et formulaire, admins affectés, lien et QR d’inscription |
| SA6 | Comptes admins : tableau avec matrice d’affectation aux événements |
| SA7 | Paramètres : modèles des emails avec onglets, variables et aperçu ; durée du scan |
| SA8 | Exports et journal d’activité |
| SA9 | **Tous les invités** (exigé par le prompt, absent du design) : tableau A4 en palette MDE, avec filtres événement et programme |

---

## 3. Composants partagés (frontend)

- **Thème** : `ThemeProvider` qui pose sur la racine `--p --s --ph --ps --ss --op --os --hd` à partir des deux couleurs du programme ; `MdeTheme`, palette fixe ; `GraphiteTheme` pour le scan.
- **Icônes** : `Icon` + les ~70 tracés SVG de `mde.js` (trait 2 px, une seule famille).
- **Primitives** :
  - boutons : `Button` (principal, secondaire, lien, destructif, chargement, désactivé), `IconButton` ;
  - champs : `TextField` (préfixe +225, valide, erreur, `data-fw`), `Select`, `Checkbox`, `Textarea`, `ColorField` ;
  - sélecteurs : `Segmented`, utilisé pour civilité, statut, durée, onglets, en version radiogroup ;
  - affichage : `Badge` (Inscrit, Présent, Déjà émargé, Invalide, Annulé, statuts d’email), `Card`, `KpiCard`, `Skeleton` ;
  - mise en page : `Toast` et `ToastRegion` (`aria-live`), `Dialog` (alertdialog), `SidePanel` (dialog), `BottomSheet` (scan), `GradientHeader`, `PageShell` (barre latérale, en-tête, contenu qui chevauche de −48 px).
- **Métier** : `QrImage` (PNG servi par l’API), `Viewfinder` (cadre de visée animé), `ResultOverlay`, `Keypad`, `GuestTable` (TanStack Table, partagé entre Admin et Super admin), `GuestPanel`, `Timeline`, `ArrivalsChart`, `ModeDistribution` (Recharts), `EmailPreviewFrame`.
- **Utilitaires** :
  - `tokens.js` : `deriveTheme(p, s)`, `contrast`, `onColor`, testés ;
  - `format.js` : dates françaises, heures « 18h42 », fuseau Africa/Abidjan ;
  - `schemas.js` : schémas Zod, mêmes règles que le backend ;
  - `useUrlState` : filtres synchronisés avec l’URL ;
  - `scanQueue.js` : file IndexedDB ;
  - `feedback.js` : son (Web Audio) et vibration ;
  - `useWakeLock`, `useCamera`.

---

## 4. Routes frontend (React Router)

| Route | Écran | Accès |
|---|---|---|
| `/i/:slug` | I1 à I8 (l’état vient de l’API) | Public |
| `/i/:slug/confirmation` | I3 (état passé par la navigation ; sans état, retour au formulaire) | Public |
| `/connexion` | A1. Après connexion, redirection selon le rôle | Public |
| `/admin` | A2 Choix de la cérémonie | ADMIN, SUPER_ADMIN |
| `/admin/evenements/:id` | A3 Tableau de bord | idem, limité à ses événements |
| `/admin/evenements/:id/invites?q=&statut=&mode=&magazine=&email1=&tri=&page=&taille=&fiche=` | A4, A5, A6 | idem |
| `/admin/evenements/:id/emails` | A7 | idem |
| `/scan` | S1 Configuration | ADMIN, SUPER_ADMIN |
| `/scan/:id` | S2 à S12 (disposition selon l’appareil) | idem |
| `/super/connexion` | SA1 | Public |
| `/super` | SA2 | SUPER_ADMIN |
| `/super/programmes/:id?` | SA3, SA4 | SUPER_ADMIN |
| `/super/evenements/:id?` (`nouveau` pour la création) | SA5 | SUPER_ADMIN |
| `/super/invites?evenement=&programme=&…` | SA9 | SUPER_ADMIN |
| `/super/admins` | SA6 | SUPER_ADMIN |
| `/super/parametres` | SA7 | SUPER_ADMIN |
| `/super/journal` | SA8 | SUPER_ADMIN |
| `/` | Redirection vers `/connexion` | — |
| `*` | Page 404 sobre, palette MDE | — |

---

## 5. API REST (`/api/`, OpenAPI via drf-spectacular sur `/api/schema/` et `/api/docs/`)

Le JSON est en camelCase (`djangorestframework-camel-case`) ; le code Python reste en snake_case.

### Public (sans authentification, avec limitation de débit)
| Méthode | Route | Détail |
|---|---|---|
| GET | `/public/evenements/{slug}/` | Nom affiché, date, heures, lieu, lien de carte, couleurs et tokens dérivés, `etat` : `OUVERT \| FERME \| COMPLET \| DATE_LIMITE` ; 404 → lien invalide |
| POST | `/public/evenements/{slug}/inscription/` | 201 en cas de succès, ou 409 avec `code` : `FERME \| COMPLET \| DATE_LIMITE \| DEJA_INSCRIT`, ou 400 pour la validation |
| POST | `/public/evenements/{slug}/renvoi-qr/` | `{email}` → réponse **toujours identique** (202), 3 renvois par heure et par adresse |
| GET | `/public/evenements/{slug}/agenda.ics` | Fichier .ics de l’événement, sans donnée personnelle (bouton « Ajouter à l’agenda » de la confirmation) |

### Authentification (JWT en cookies httpOnly + CSRF)
`POST /auth/connexion/` · `POST /auth/deconnexion/` · `POST /auth/rafraichir/` · `GET /auth/moi/` · `GET /auth/csrf/`

### Scan
| Méthode | Route | Détail |
|---|---|---|
| POST | `/evenements/{id}/emargement/` | `{qrToken \| code \| inviteId, mode, poste, appareil, dateClient}` → `{resultat, invite, presentLe, poste, evenementAutre, magazineEnvoye, presents, inscrits, emargementId}`. `inviteId` sert au mode MANUEL (recherche et tableau admin) |
| POST | `/emargements/{id}/annulation/` | `{motif}` |
| GET | `/evenements/{id}/emargements/recents/` | Derniers passages : historique de l’ordinateur et « dernier » |

### Invités
| Méthode | Route |
|---|---|
| GET, POST | `/evenements/{id}/invites/` : pagination 25/50/100, `q`, `statut`, `mode`, `magazine`, `email1`, `ordering`, compteurs `{tous, inscrits, presents, aRenvoyer}` |
| GET, PATCH | `/invites/{id}/` |
| GET | `/invites/{id}/qr.png` (fiche admin) |
| POST | `/invites/{id}/renvoi-email/` |
| GET | `/invites/{id}/historique/` |
| POST | `/evenements/{id}/invites/actions-groupees/` : `{action: VALIDER \| RENVOYER \| EXPORTER, ids \| filtres}` ; au-delà de 50 invités, une tâche Celery est lancée et `{tacheId}` est renvoyé |
| GET | `/evenements/{id}/invites/export/?format=xlsx\|csv&…filtres\|ids` |
| GET | `/taches/{id}/` (état d’une tâche Celery et lien de téléchargement) |

### Statistiques
`GET /evenements/{id}/statistiques/` renvoie les indicateurs, les arrivées par tranche de 15 minutes, la répartition par mode, les emails et la comparaison avec les éditions précédentes du même programme.
`GET /evenements/{id}/apercu-emails/` alimente l’écran A7.

### Super admin
| Route | Détail |
|---|---|
| `/programmes/` | CRUD ; DELETE refusé (409) si le programme a des événements |
| `/evenements/` | CRUD (les admins ne lisent que leurs événements) |
| `POST /evenements/{id}/regenerer-slug/` | |
| `GET /evenements/{id}/qr-inscription.png` | |
| `/admins/` | CRUD et désactivation |
| `POST /admins/{id}/reinitialiser-mot-de-passe/` | |
| `GET, PATCH /parametres/` · `POST /parametres/apercu-email/` | |
| `GET /journal/?auteur=&action=&du=&au=` | |
| `GET /invites/?evenement=&programme=&…` | Tous événements |
| `GET /exports/{invites\|presences\|emails\|journal}/?format=` | Cartes « Exports » du design |

---

## 6. Modèle de données (Django, MySQL utf8mb4, stockage en UTC)

```
Programme(id, nom UNIQUE, couleur_principale, couleur_secondaire [#RRGGBB, majuscules], actif,
          magazine_actif, lien_magazine, cree_le, modifie_le)
Evenement(id, programme FK PROTECT, date, heure_debut, heure_accueil, lieu, lien_carte, capacite,
          date_limite_inscription, inscriptions_ouvertes, slug_inscription UNIQUE, admins M2M Admin,
          cree_le, modifie_le)
          nom_affiche = f"Graduation {programme.nom} {date.year}"  (propriété calculée, jamais stockée)
Statut(id, code UNIQUE, libelle, ordre)  → INSCRIT, PRESENT (data migration)
          constantes : statuts.INSCRIT = "INSCRIT", statuts.PRESENT = "PRESENT"
Invite(id, evenement FK, statut FK PROTECT défaut INSCRIT, civilite MME|M, nom, prenom, email,
       telephone, entreprise, fonction, source FORMULAIRE|MANUEL, code CHAR(4), qr_token UNIQUE,
       consentement_donnees, consentement_le, inscrit_le, present_le NULL,
       mode_emargement NULL QR_CAMERA|DOUCHETTE|CODE|MANUEL)
       UNIQUE(evenement, email) · UNIQUE(evenement, code)
       INDEX qr_token · (evenement, statut) · (evenement, present_le) · (evenement, nom)
Emargement(id, invite FK, admin FK, mode, poste, appareil TELEPHONE|TABLETTE|ORDINATEUR, date,
           date_client NULL, annule_le NULL, annule_par FK NULL, motif_annulation)
EmailEnvoye(id, invite FK, type INVITATION|MAGAZINE, statut EN_ATTENTE|ENVOYE|ECHEC, tentatives,
            envoye_le NULL, erreur, cree_le)
Admin  (modèle utilisateur personnalisé AbstractBaseUser, AUTH_USER_MODEL)
       (id, nom, email UNIQUE, password [hachage Argon2], role SUPER_ADMIN|ADMIN, actif,
        derniere_connexion)
JournalActivite(id, auteur FK NULL [NULL = « Système »], action, cible_type, cible_id, details JSON, date)
       Index (date), (action), (auteur). Aucun nom ni email dans `details` : l’affichage
       reconstitue le libellé à partir de la cible.
Parametres (singleton, pk=1) (objet_email_1, corps_email_1, objet_email_2, corps_email_2,
       duree_resultat_scan 2|3|5 défaut 3, son_actif, vibration_actif,
       expediteur « Flex’Checking · MDE Business School »)
```

Règles transversales :
- **Email n°2 envoyé une seule fois** : on vérifie dans `EmailEnvoye(type=MAGAZINE, statut ∈ {EN_ATTENTE, ENVOYE})` sous `select_for_update` de l’invité.
- **Colonne « Email 1 »** : statut de la dernière ligne INVITATION, affiché « Envoyé », « En attente » ou « À renvoyer » (ECHEC).

---

## 7. Contradictions relevées entre le design et le prompt

Règle appliquée : le prompt l’emporte pour le métier, les données et la technique ; le design l’emporte pour l’apparence.

| # | Design | Prompt | Décision |
|---|---|---|---|
| C1 | « MDE Émargement » (connexion, en-têtes) ; email « De : MDE Business School » | « Flex’Checking » ; expéditeur « Flex’Checking · MDE Business School » | Prompt |
| C2 | Rôles « Admin » et « Hôte scan » | Rôles SUPER_ADMIN et ADMIN uniquement | Prompt : l’« Hôte scan » devient un ADMIN |
| C3 | Statut de compte « Invitation envoyée », bouton « Inviter un admin » | Création, désactivation, réinitialisation du mot de passe | Voir **Q1** |
| C4 | Badge « Inscrite » ou « Inscrit » selon la civilité ; email n°2 « Présente · 18h42 » | Badge « Inscrit·e » | Prompt pour la confirmation (« Inscrit·e ») ; même écriture pour l’email n°2 (« Présent·e ») |
| C5 | Pagination de 10 lignes | 25 / 50 / 100 | Prompt, avec un sélecteur dans le pied du tableau |
| C6 | Recherche « Nom, email, entreprise » | Nom, email, téléphone, entreprise, code | Prompt ; placeholder « Nom, email, téléphone, entreprise, code » |
| C7 | Texte de l’état « fermé » qui parle de date limite | Écrans distincts « fermées » et « date limite dépassée » | Prompt : I4 « Les inscriptions sont fermées » (sans mention de date), I6 dédié |
| C8 | I7 « Cette adresse est déjà inscrite » ; toast « Votre invitation et votre QR code ont été renvoyés. » | Le renvoi ne confirme jamais à un tiers qu’une adresse est inscrite | I7 est conservé (exigé par le prompt ; l’inscription révèle forcément le doublon, risque limité par la limitation de débit). Le **renvoi** répond toujours de la même façon. Toasts reformulés : « Si cette adresse est inscrite, votre invitation vient d’être renvoyée. » |
| C9 | Configuration du scan sans poste | Choix du poste | Prompt : champ « Poste » (texte, suggestions « Accueil principal », « Borne 1 »…) entre l’événement et le mode |
| C10 | Feuille Réglages : durée locale et « Simuler une coupure réseau » | Durée, son et vibration en paramètres globaux, désactivables | La durée locale part de la valeur globale et peut être modifiée sur l’appareil ; ajout des interrupteurs Son et Vibration (même style que l’interrupteur du design) ; simulation supprimée |
| C11 | Fiche invité sans QR ; historique figé en 4 étapes | Fiche avec QR, code et historique complet (inscription, emails, émargements, annulations, modifications) | Prompt : bloc QR et code sous la fiche ; la frise affiche l’historique réel avec le style de pastilles du design |
| C12 | Aucune modification d’invité dans l’interface | `PATCH /invites/{id}/` et « modifications » dans l’historique | Bouton « Modifier » dans la fiche ; les champs passent en édition avec le style des champs A6 |
| C13 | Super admin sans écran « Tous les invités » | Exigé | Ajout de SA9 dans la navigation (« Invités », icône `users`) |
| C14 | Formulaire d’événement sans heure d’accueil, lien carte, ouverture des inscriptions, régénération | Exigés | Champs ajoutés dans la même grille ; interrupteur « Inscriptions ouvertes » ; bouton « Régénérer le lien » avec dialogue de confirmation (gabarit SA4) |
| C15 | Éditeur de programme sans nom, lien magazine ni activation de l’email n°2 ; options de programme codées en dur | Exigés ; liste de programmes dynamique | Champs « Nom », « Lien du magazine » et interrupteur « Envoyer l’email n°2 » ajoutés ; listes alimentées par l’API (programmes actifs) |
| C16 | Paramètres sans son ni vibration | Exigés | Section ajoutée sous « Durée d’affichage », même gabarit |
| C17 | Journal filtrable par type seulement | Par auteur, action et période | Deux filtres ajoutés (auteur, du/au) dans l’en-tête de la carte |
| C18 | Modèles d’emails en texte libre, alors que l’email du design est structuré en cartes | Modèles éditables avec variables | Le corps est rendu ainsi : texte avant `{qr_code}` dans la carte message, `{qr_code}` remplacé par la carte QR et code de secours, texte après dans une carte, puis infos pratiques et boutons toujours ajoutés. Le texte par défaut reprend mot pour mot celui du design. Aperçu : HTML réel de l’API (`/parametres/apercu-email/`) dans le cadre d’aperçu du design |
| C19 | Email n°2 avec emplacement « COUVERTURE MAGAZINE » | Message court, bouton, lien en clair ; aucun champ image au modèle | Emplacement retiré (aucune donnée) ; ajout du lien en clair sous le bouton |
| C20 | Polices Google Fonts (400–700, 800 utilisé) | `@fontsource/poppins` auto-hébergée | Prompt ; graisses 400, 500, 600, 700, 800 |
| C21 | Borne : la recherche liste tous les invités avec leur email | Aucune règle explicite, mais sécurité et données personnelles | Voir **Q4** |
| C22 | Lien « Mot de passe oublié ? » sur la connexion admin | Aucun parcours de réinitialisation libre-service | Voir **Q2** |
| C23 | Compteurs « / 240 » et capacité 260 codés en dur | Données réelles | Valeurs de l’API |
| C24 | Format du lien `…/i/amp-2026` | `slugInscription` unique et régénérable | Slug `amp-2026-x7k2q9` (lisible + 6 caractères aléatoires), régénérable |
| C25 | Résultat hors ligne absent du design | « Enregistré, vérification à la reconnexion » | Écran plein résultat sur fond avertissement, icône wifiOff |
| C26 | Emails : cartes qui chevauchent l’en-tête, icônes SVG | Compatibilité Gmail / Outlook | Pas de marge négative ; icônes PNG générées côté serveur |

Interprétations notées pour le README :
- La disposition du scan (téléphone, borne, ordinateur) est détectée automatiquement d’après l’écran et le pointeur tactile. Elle peut être forcée dans S1 avec un segment « Appareil », au style des modes.
- L’entrée « Emails » de la navigation admin ouvre A7 en lecture seule.
- Le lien « Lieu » du bandeau d’en-tête invité affiche le lieu complet, tronqué avec des points de suspension.

---

## 8. Sécurité et technique (rappel des choix)

- **Authentification** : SimpleJWT, jetons `access` (15 min) et `refresh` (12 h, rotation et liste noire) en cookies `httpOnly`, `Secure`, `SameSite=Lax`, avec en-tête `X-CSRFToken` vérifié sur les requêtes modifiantes.
- **Hachage** : Argon2 (`argon2-cffi`).
- **Permissions** : `IsSuperAdmin` ; `IsAdminOfEvent`, avec un queryset filtré par `evenement__admins=user` sur chaque vue.
- **Limitation de débit** (DRF + cache Redis) :
  - connexion : 5 par minute par IP et par email ;
  - inscription : 10 par heure par IP ;
  - renvoi : 3 par heure par email et 10 par heure par IP ;
  - émargement par code : 30 par minute par appareil.
- **Émargement** : `transaction.atomic` + `select_for_update`, idempotent ; envois d’email avec `transaction.on_commit` + Celery (3 nouvelles tentatives, délai progressif de 30 s, 2 min et 8 min).
- **Mode hors ligne** : file IndexedDB `{id, qrToken|code, mode, poste, appareil, dateClient}`, synchronisée au retour du réseau ; le serveur reste l’arbitre.
- **Journalisation** : filtre qui masque emails et téléphones dans les logs applicatifs.
- **En-têtes de sécurité** : CSP stricte, HSTS (production), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (caméra limitée au même site).
- **Développement** : Docker Compose `mysql`, `redis`, `django`, `celery`, `frontend` (Vite) et `proxy` (Caddy + certificats mkcert pour `https://flex-checking.localhost` et l’IP du réseau local).

---

## 9. Questions (validées le 9 octobre 2026 : propositions retenues)

- **Q1 — Création des comptes admins.** Le design prévoit une invitation par email (« Invitation envoyée »), le prompt une création avec réinitialisation.
  - *Proposition* : le super admin crée le compte, un mot de passe temporaire est généré et **affiché une seule fois** dans un dialogue (copiable), puis l’admin doit le changer à la première connexion. Même mécanisme pour la réinitialisation. Statuts affichés : « Actif » et « Désactivé ».
  - *Variante* : envoi d’un lien d’activation par email (statut « Invitation envoyée »).
- **Q2 — « Mot de passe oublié ? »** *Proposition* : le lien ouvre un message « Contactez la direction des événements MDE pour réinitialiser votre mot de passe », sans parcours libre-service.
- **Q3 — Logo.** Le logo Flex’Checking fourni contient le monogramme MDE ; je l’utilise partout à la place de « LOGO MDE ». Existe-t-il un logo officiel MDE Business School distinct à afficher en plus, par exemple dans les emails et la connexion super admin ?
- **Q4 — Recherche sur la borne libre-service.** *Proposition* : sur la borne seulement, aucune liste n’apparaît avant 3 caractères saisis, et l’email est masqué (« Entreprise » seule, ou « a•••@sib.ci »). Sur téléphone et ordinateur, tenus par un hôte, l’affichage reste celui du design.

---

## 10. Découpage des phases (rappel)

| Phase | Contenu |
|---|---|
| 1 | Socle : dépôt, Docker et HTTPS, modèles, migrations, data migrations, `seed_demo`, authentification et rôles, thème, composants de base, `deriveTheme` en JS et en Python avec des tests de référence communs (`shared/token-fixtures.json`) |
| 2 | Super admin (SA1 à SA9), exports, journal |
| 3 | Invité (I1 à I8), email n°1, `EmailEnvoye` et relances |
| 4 | Scan (S1 à S12), PWA, hors ligne, email n°2 |
| 5 | Admin (A1 à A7) |
| 6 | Finition : accessibilité, responsive, tests pytest et Playwright, README, récapitulatif |

Chaque phase se termine par un build, un lint et des tests au vert, puis un compte rendu, et j’attends votre validation.
