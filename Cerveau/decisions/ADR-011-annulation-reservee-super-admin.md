---
type: decision
statut: acceptée
verifie: 2026-10-14
commit: 36389e6
sources: [backend/apps/noyau/vues_scan.py, backend/apps/noyau/vues_invites.py, frontend/src/features/scan/ScanPoste.jsx, frontend/src/features/scan/composants.jsx, frontend/src/features/invites/GestionInvites.jsx]
---

# ADR-011 — Annulation d'un émargement réservée au super admin

- **Date** : 2026-10-14 (demande de l'utilisateur : « l'admin ne doit pas avoir la possibilité d'annuler un
  émargement, seul le super admin doit pouvoir le faire »)
- **Statut** : acceptée

## Contexte
Un admin d'accueil pouvait annuler le dernier émargement depuis le scan (`POST emargements/<id>/annulation/`) et
annuler la présence d'un invité depuis la gestion des invités (`POST invites/<id>/presence/annulation/`).

## Décision
Les deux routes exigent `EstSuperAdmin` (403 pour un admin). L'interface masque les commandes aux admins :
- scan : outil « Annuler » (téléphone), « Annuler le dernier » (ordinateur), « Annuler le dernier émargement »
  (réglages / espace hôte de la borne) ;
- gestion des invités : bouton « Annuler la présence » (ligne, carte mobile, fiche) — l'admin ne voit que « Valider ».

## Conséquences
- Une erreur d'émargement à l'accueil doit être signalée au super admin (direction des événements), qui l'annule
  depuis la gestion des invités ou le scan.
- Valider une présence reste ouvert aux admins (scan, ligne, actions groupées).
- Tests : `test_annulation_reservee_au_super_admin`, `test_modification_et_historique` (403 pour l'admin).
