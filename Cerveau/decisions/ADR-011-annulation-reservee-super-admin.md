---
type: decision
statut: acceptée
verifie: 2026-10-26
commit: 44eceb5
sources: [backend/apps/noyau/vues_scan.py, backend/apps/noyau/vues_invites.py, backend/apps/comptes/permissions.py, frontend/src/features/scan/ScanPoste.jsx, frontend/src/features/scan/composants.jsx, frontend/src/features/invites/GestionInvites.jsx, backend/apps/noyau/tests/test_emargement.py, backend/apps/noyau/tests/test_invites.py, backend/apps/noyau/tests/test_durcissement.py, backend/apps/noyau/services.py, backend/apps/noyau/donnees_personnelles.py]
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
- Tests : `test_emargement.py::test_annulation_reservee_au_super_admin`,
  `test_annulation_puis_reemargement_sans_second_magazine` (annulation par le super admin),
  `test_invites.py::test_modification_et_historique` (403 pour l'admin).
- Mise en œuvre vérifiée au commit `be899ff` (livrée par `bd4f807`) : `AnnulationView` et `AnnulerPresenceView`
  en `EstSuperAdmin` ; côté interface, `peutAnnuler = moi.role === 'SUPER_ADMIN'` dans `ScanPoste.jsx` (outil
  retiré de la barre, grille de 4 outils au lieu de 5 sur téléphone), `FeuilleReglages` n’affiche le bouton que si
  `onAnnulation` est fourni, `BoutonPresence` ne rend rien pour un invité présent si le compte n’est pas super admin.
  Aucun test frontend ni e2e ne couvre le masquage (recherche dans `frontend/tests/` et `frontend/e2e/`).
- Compléments du 2026-10-22 (revérifiés au commit `44eceb5`, sans changement de décision) : le motif d'annulation
  est refusé s'il contient un caractère de contrôle (`validate_motif` → `validation.sans_controle`, dans
  `vues_scan.py` et `vues_invites.py`) ; un scan hors ligne **rejoué** dont l'heure d'appareil précède une annulation
  ne repasse pas l'invité présent (résultat `ANNULE_DEPUIS`, voir [scan-emargement](../features/scan-emargement.md)) ;
  les motifs d'annulation sont effacés à l'anonymisation des données personnelles
  ([donnees-personnelles](../features/donnees-personnelles.md)).
