---
type: feature
statut: implémenté
verifie: 2026-11-09
commit: 021396e
sources: [frontend/src/features/admin/ChoixCeremonie.jsx, frontend/src/features/admin/EspaceEvenement.jsx, frontend/src/features/admin/TableauDeBord.jsx, frontend/src/features/admin/SuiviEmails.jsx, frontend/src/features/admin/CarteSatisfaction.jsx, frontend/src/lib/tempsReel.js, backend/apps/noyau/suivi_emails.py, backend/apps/noyau/vues_sondage.py, backend/apps/noyau/statistiques.py, backend/apps/noyau/vues_admin.py]
---

# Espace admin : cérémonies et tableau de bord

**Utilisateurs** : `ADMIN` (uniquement ses cérémonies affectées) et `SUPER_ADMIN` (toutes).

## A2 · Choix de la cérémonie (`/admin`)
Univers MDE. Cérémonie(s) du jour en grande carte aux couleurs du programme (accès tableau de bord et scan,
présents / inscrits / taux / capacité), agenda « À venir » (date, monogramme, statut, remplissage), « Éditions
passées » repliables. Lien « Espace super admin » pour le super admin.
Monogramme du programme dans l’agenda : initiales des premiers mots puis le dernier en entier (AMP, PMD, **PAMP**, **PASD**), 4 lettres max (`monogramme`).
Statuts (`services.statut_evenement`) : En cours (jour J), Inscriptions ouvertes, Inscriptions fermées, Complet, Terminée.

## Mise en page (`EspaceEvenement`)
Barre latérale (Tableau de bord, Invités, Scan, Emails — la page s’intitule « Suivi des emails ») masquée sous 961 px ; en-tête en dégradé du programme
avec indicateur « En direct », « Reconnexion… » ou « Actualisation auto » (temps réel indisponible) · « mis à jour il y a N s », bouton « Rapport PDF », « Ouvrir le scan ».

## A3 · Tableau de bord (`GET /evenements/<id>/statistiques/`, cache 30 s invalidé)
- 4 indicateurs (2 colonnes sur mobile, 4 sur grand écran) : inscrits (capacité), présents (+N sur 15 min le jour J), non présents / absents, taux (comparé
  à l’édition précédente).
- **Arrivées à l’accueil** (`ArriveesParTranche`) : invités émargés par tranche de 15 min, de l’accueil au début
  + 1 h, étendues aux arrivées réelles, ≤ 48 tranches (calcul serveur). Résumé (arrivées, pic, +N sur 15 min le jour J),
  axe des valeurs et quadrillage, au plus 10 heures sur l’axe, repère pointillé « Lancement HHhMM », bande « En cours »
  le jour J (`trancheEnCours`, calculée par le serveur ; statistiques rechargées chaque minute le jour J même en temps
  réel), info-bulle (tranche, arrivées, total cumulé). Présences enregistrées un autre jour : message dédié. Sans arrivée : message explicite selon le moment (avant :
  date et heure d’accueil ; jour J : « apparaît en direct » ; terminée : « aucune arrivée enregistrée »).
- Répartition par mode (anneau + légende), arrivées par poste (8 max), inscriptions cumulées par jour.
- Suivi des emails : n°1 envoyés / inscrits, n°2 envoyés / présents (si magazine actif), alerte « invitations à
  renvoyer » → lien `invites?email1=ECHEC`. L’email n°3 n’y figure pas (voir A7 et la carte Satisfaction).
- Comparaison avec les 5 dernières éditions du même programme.
- **Carte « Satisfaction des participants »** (`CarteSatisfaction.jsx`, 2026-10-14) : `GET /evenements/<id>/sondage/`
  (admin, `sondages.resultats`), temps réel (sujet `sondage`) sinon 30 s. Sous-titre selon l’état (`A_VENIR` : date
  d’envoi prévue ; `EN_COURS` : clôture, « résultats en direct » ; `TERMINE` ; désactivé). Dès l’envoi : réponses /
  envoyés et taux, notes satisfaction et accueil (étoiles), NPS avec libellé (≥ 50 Excellent, ≥ 20 Très bon, ≥ 0
  Correct, sinon À améliorer) ; après la première réponse : répartition des notes, recommandation et derniers
  commentaires (4 visibles, dépliables) — [sondage-satisfaction](sondage-satisfaction.md).
- Lien d’inscription à copier (sauf cérémonie terminée).
Rafraîchissement : temps réel, sinon toutes les 5 s ; 15 s en cas d’erreur.

## A7 · Suivi des emails (`/admin/evenements/<id>/emails`)
Page de suivi (remplace l’ancien aperçu en lecture seule, jugé inutile par l’utilisateur le 2026-10-14) :
`frontend/src/features/admin/SuiviEmails.jsx` (`ApercuEmails.jsx` supprimé), une carte par email : n°1 Invitation,
n°2 Magazine, **n°3 Sondage de satisfaction** (« envoyé le lendemain à 8 h, ouvert 24 h »).
- **Invités à contacter** (2026-11-09, en tête de page ; l’utilisateur jugeait l’écran « pas très utile » : des
  compteurs, et « Envoyés » ne prouve pas la réception) : une ligne par invité dont un email n’est pas, ou
  probablement pas, arrivé — `suivi_emails.a_contacter`, clé `aContacter` de `GET …/suivi-emails/` (`total`,
  `causesEnvoi`, `invites`, 200 au plus ; invités anonymisés exclus ; 4 requêtes quel que soit le nombre d’invités ; `causesEnvoi` = nombre d’**invités** dont un problème vient de l’envoi, y compris jamais envoyée et bloquée).
  Problèmes : **invitation jamais envoyée** (sauf invité ajouté à la main en décochant l’envoi : journal `INVITE_AJOUT` `email_envoye: false`) ; **dernier envoi en échec** avec sa cause lue dans l’erreur SMTP
  (`suivi_emails.cause_echec`, notre côté testé en premier — expéditeur refusé, identifiants refusés, filtrage 5.7.x,
  email trop volumineux 5.3.4 —, puis adresse inexistante, domaine inexistant, boîte pleine, adresse refusée côté
  « adresse », enfin serveur injoignable ou inconnue côté « envoi » ; revue du 2026-11-09 : un rejet Gmail 5.7.26
  qui cite « users » n’est plus imputé à l’adresse de l’invité) ;
  n°2 et n°3 seulement pour un invité encore présent, échecs « Sondage non envoyé » (lien clos) ignorés ; **envoi
  bloqué** en attente depuis plus de 15 min ; **adresse probablement mal tapée** (`adresses.suggerer_correction` :
  domaine à 1 ou 2 fautes d’un fournisseur courant — gmial.com → gmail.com —, jamais pour un domaine réel proche
  comme ymail.com, orange.ci, ni un domaine national d’un grand fournisseur — hotmail.be, yahoo.es, aol.fr —, ni une
  adresse professionnelle ; mde.ci corrigé seulement sur l’extension — mde.cii), signalée même si l’envoi a « réussi ». Chaque ligne :
  nom → fiche, statut, adresse (+ correction proposée), causes, téléphone en lien `tel:`, et une action : « Corriger
  et renvoyer » (suggestion : `PATCH invites/<id>/` puis `POST invites/<id>/renvoi-email/`), « Corriger l’adresse »
  (→ fiche) ou « Renvoyer » (« Nouvel essai automatique » à la place quand l’envoi est seulement en file, pour éviter un doublon ;
  écran rechargé même si le renvoi échoue après la correction). Lignes « à corriger » en premier ; bandeau quand des échecs viennent du serveur d’envoi.
  Aucun invité : « Aucun invité à contacter ». Note en bas : « Envoyés » = accepté par le serveur d’envoi.
- **Compteurs** envoyés / en attente / en échec, d’après le **dernier envoi** de chaque type par invité
  (`GET /evenements/<id>/suivi-emails/`, `suivi_emails.suivi` ; rechargé par le temps réel — sujets `statistiques` et
  `sondage` —, sinon toutes les 15 s).
- **Échecs** (dans chaque carte, 2026-11-09) : un seul bandeau « N invités n’ont pas reçu cet email » (le détail est
  dans « Invités à contacter » ; `listeEchecs` retirée de l’API le 2026-11-09) ; bouton « Renvoyer les N emails » avec confirmation
  (`POST /evenements/<id>/suivi-emails/renvoyer-echecs/` `{type}`, 10/h par compte, `suivi_emails.renvoyer_echecs`) ;
  lien vers la liste des invités filtrée `?email1=ECHEC` (invitation seulement). Renvoi ignoré pour les n°2 et n°3
  si l’invité n’est plus Présent, et pour le n°3 si le lien a expiré (24 h). Le n°3 repart **que l’invité ait
  répondu ou non** (même total, même journal : l’admin ne peut pas déduire qui a répondu ; un invité qui a déjà
  répondu reçoit de nouveau son lien, qui affiche « déjà répondu » — `7e0e071`). Journal `EMAIL_RENVOI` si au moins
  un envoi.
- **M’envoyer un test** — rangé avec l’aperçu dans le volet replié « Aperçu et email de test » de chaque carte
  (2026-11-09) — (`POST /evenements/<id>/suivi-emails/test/`, 10/h par compte) : l’email rempli avec
  l’invitée fictive part à l’adresse du compte connecté, objet préfixé « [Test] » ; aucune ligne `EmailEnvoye`
  créée ; échec SMTP → 502 `ENVOI_IMPOSSIBLE` ; journal `EMAIL_TEST`.
- **Aperçu** replié (`GET /evenements/<id>/apercu-emails/`, les trois types ; iframe `sandbox=""`, données fictives
  « Mme Aya Kouassi », code 4827, lien de sondage factice), chargé à l’ouverture.
- Magazine ou sondage désactivé pour le programme : carte avec message, sans test ni aperçu (le serveur refuse
  aussi test et renvoi : `MAGAZINE_INDISPONIBLE` / `SONDAGE_INDISPONIBLE`).

## Rapport PDF
`GET /evenements/<id>/rapport/` (ReportLab, données agrégées, 30/h par compte), journalisé comme export ; inclut la
section satisfaction une fois le sondage envoyé ([exports-rapports](exports-rapports.md)).

## Tests
`backend/apps/noyau/tests/test_suivi_emails.py`, `test_sondage.py` ; `frontend/tests/tableauDeBord.test.jsx`,
`frontend/tests/suiviEmails.test.jsx`.

Voir aussi : [gestion-invites](gestion-invites.md), [temps-reel](temps-reel.md), [exports-rapports](exports-rapports.md).
