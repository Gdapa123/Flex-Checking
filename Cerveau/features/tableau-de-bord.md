---
type: feature
statut: implémenté
verifie: 2026-10-26
commit: 44eceb5
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
- **Compteurs** envoyés / en attente / en échec, d’après le **dernier envoi** de chaque type par invité
  (`GET /evenements/<id>/suivi-emails/`, `suivi_emails.suivi` ; rechargé par le temps réel — sujets `statistiques` et
  `sondage` —, sinon toutes les 15 s).
- **Échecs** : liste (5 visibles, 50 au plus renvoyés par l’API) avec nom → fiche de l’invité, adresse, erreur SMTP,
  tentatives, date ; bouton « Renvoyer les N emails » avec confirmation
  (`POST /evenements/<id>/suivi-emails/renvoyer-echecs/` `{type}`, 10/h par compte, `suivi_emails.renvoyer_echecs`) ;
  lien vers la liste des invités filtrée `?email1=ECHEC` (invitation seulement). Renvoi ignoré pour les n°2 et n°3
  si l’invité n’est plus Présent, et pour le n°3 si le lien a expiré (24 h). Le n°3 repart **que l’invité ait
  répondu ou non** (même total, même journal : l’admin ne peut pas déduire qui a répondu ; un invité qui a déjà
  répondu reçoit de nouveau son lien, qui affiche « déjà répondu » — `7e0e071`). Journal `EMAIL_RENVOI` si au moins
  un envoi.
- **M’envoyer un test** (`POST /evenements/<id>/suivi-emails/test/`, 10/h par compte) : l’email rempli avec
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
