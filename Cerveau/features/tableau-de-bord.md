---
type: feature
statut: implémenté
verifie: 2026-10-14
commit: 36389e6
sources: [frontend/src/features/admin/ChoixCeremonie.jsx, frontend/src/features/admin/EspaceEvenement.jsx, frontend/src/features/admin/TableauDeBord.jsx, frontend/src/features/admin/SuiviEmails.jsx, backend/apps/noyau/suivi_emails.py, backend/apps/noyau/statistiques.py, backend/apps/noyau/vues_admin.py]
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
Barre latérale (Tableau de bord, Invités, Scan, Emails) masquée sous 961 px ; en-tête en dégradé du programme
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
- Suivi des emails : n°1 envoyés / inscrits, n°2 envoyés / présents, alerte « invitations à renvoyer » → lien
  `invites?email1=ECHEC`.
- Comparaison avec les 5 dernières éditions du même programme.
- Lien d’inscription à copier (sauf cérémonie terminée).
Rafraîchissement : temps réel, sinon toutes les 5 s ; 15 s en cas d’erreur.

## A7 · Suivi des emails (`/admin/evenements/<id>/emails`)
Page de suivi (remplace l’ancien aperçu en lecture seule, jugé inutile par l’utilisateur le 2026-10-14) :
`frontend/src/features/admin/SuiviEmails.jsx`, une carte par email (n°1 Invitation, n°2 Magazine).
- **Compteurs** envoyés / en attente / en échec, d’après le **dernier envoi** de chaque type par invité
  (`GET /evenements/<id>/suivi-emails/`, rafraîchi toutes les 15 s).
- **Échecs** : liste (5 visibles, 50 au plus renvoyés par l’API) avec nom → fiche de l’invité, adresse, erreur SMTP,
  tentatives, date ; bouton « Renvoyer les N emails » avec confirmation ; lien vers la liste des invités filtrée
  `?email1=ECHEC` (invitation seulement).
- **M’envoyer un test** : l’email rempli avec l’invitée fictive part à l’adresse du compte connecté, objet préfixé
  « [Test] » ; aucune ligne `EmailEnvoye` créée.
- **Aperçu** replié (iframe `sandbox`, données fictives « Mme Aya Kouassi », code 4827), chargé à l’ouverture.
- Magazine désactivé : carte avec message, sans test ni aperçu.

## Rapport PDF
`GET /evenements/<id>/rapport/` (ReportLab, données agrégées, 30/h par compte), journalisé comme export.

Voir aussi : [gestion-invites](gestion-invites.md), [temps-reel](temps-reel.md), [exports-rapports](exports-rapports.md).
