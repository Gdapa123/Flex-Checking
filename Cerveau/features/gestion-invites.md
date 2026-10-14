---
type: feature
statut: implémenté
verifie: 2026-10-14
commit: 36389e6
sources: [frontend/src/features/invites/GestionInvites.jsx, frontend/src/features/invites/PanneauInvite.jsx, frontend/src/features/invites/PanneauAjout.jsx, backend/apps/noyau/vues_invites.py, backend/apps/noyau/filtres.py, backend/apps/noyau/taches.py]
---

# Gestion des invités (A4–A6, SA9)

Un seul composant, `GestionInvites`, sert à l’admin (une cérémonie, univers programme) et au super admin
(« Tous les invités », univers MDE, filtres événement et programme, pas de sélection groupée).

## Liste
- **Indicateurs-filtres** : Tous, Inscrits non présents, Présents, Invitations à renvoyer (email n°1 en ÉCHEC).
- **Recherche** (différée 300 ms) : nom, prénom, email, entreprise, code ; une saisie numérique de ≥ 3 chiffres
  cherche dans le téléphone (espaces ignorés) ou le code. 6 mots maximum, tous requis.
- **Filtres** : statut, mode d’émargement, magazine (envoyé / non, masqué si désactivé).
- **Tri** serveur (`filtres.TRIS`) : menu « Trier par » + en-têtes cliquables ; seul le critère principal change de
  sens, égalités par nom A→Z ; dernier tri mémorisé sur l’appareil.
- **Pagination** 25 / 50 / 100. Tout l’état est dans l’URL (`useUrlState`), y compris la fiche ouverte (`fiche=`).
- Vue tableau (≥ lg) ou cartes (mobile). Rafraîchi en temps réel (5 s en secours).

## Actions
| Action | Où | Droits | Détail |
|---|---|---|---|
| Valider la présence | ligne, fiche, sélection | admin | émargement MANUEL, poste « Tableau admin », appareil ORDINATEUR |
| Annuler la présence | ligne, fiche | **super admin** ([ADR-011](../decisions/ADR-011-annulation-reservee-super-admin.md)) | dialogue de confirmation ; bouton masqué aux admins |
| Renvoyer l’invitation | fiche, sélection (confirmation) | admin | nouvel EmailEnvoye |
| Renvoyer l’email n°2 | fiche | admin | invité Présent et lien magazine requis |
| Modifier la fiche | fiche | admin | PATCH, journalisé avec la liste des champs |
| Exporter (vue filtrée ou sélection) | barre / sélection | admin | CSV ou Excel ([exports](exports-rapports.md)) |
| Supprimer | fiche, sélection | **super admin** | définitif (emails, émargements) ; journal = nombre seulement |
| Ajouter un invité | « Ajouter un invité » (A6) | admin | source MANUEL, tous champs obligatoires, email n°1 optionnel |

Au-delà de **50 invités**, actions groupées et exports passent en tâche Celery (202 + `tacheId`, suivi par
`/taches/<id>/`, fichier à usage unique supprimé au téléchargement, purge après 6 h).

## Fiche (A5)
Fiche, QR code (PNG servi par l’API, `Cache-Control: private`) et code de secours, historique complet
(inscription, chaque email, émargements, annulations, modifications), étape « En attente du passage ».

## Limites
- Modification : entreprise et fonction facultatives ([R3](../project/risques-et-dette.md)).

## Tests
`test_invites.py` (compteurs, recherche, filtres et tris, ajout, modification et historique, actions groupées,
export CSV/XLSX, tâches > 50, neutralisation des formules, purge) ; `test_suppressions.py`.
