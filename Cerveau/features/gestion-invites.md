---
type: feature
statut: implémenté
verifie: 2026-10-27
commit: bed9942
sources: [backend/apps/noyau/sondages.py, backend/apps/noyau/suivi_emails.py, backend/apps/noyau/tests/test_durcissement.py, frontend/src/features/invites/GestionInvites.jsx, frontend/src/features/invites/PanneauInvite.jsx, frontend/src/features/invites/PanneauAjout.jsx, backend/apps/noyau/vues_invites.py, backend/apps/noyau/filtres.py, backend/apps/noyau/taches.py, backend/apps/noyau/models.py, backend/apps/noyau/tests/test_invites.py]
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
| Annuler la présence | ligne, fiche | **super admin** ([ADR-011](../decisions/ADR-011-annulation-reservee-super-admin.md)) | `AnnulerPresenceView` en `EstSuperAdmin` ; dialogue de confirmation ; motif sans caractère de contrôle ; `BoutonPresence` ne rend rien à un admin pour un invité présent |
| Renvoyer l’invitation | fiche, sélection (confirmation) | admin | nouvel EmailEnvoye. Fiche : 5 renvois/h par compte et par invité (`RenvoiEmailThrottle`). Sélection : invités ayant déjà reçu une invitation depuis moins d’1 h ignorés (réponse `{traites, ignores}`), 5 renvois groupés/h par compte (429 `TROP_DE_TENTATIVES`), journal seulement si au moins un envoi |
| Renvoyer l’email n°2 | fiche | admin | invité Présent et magazine disponible (`magazine_actif` et lien, `suivi_emails.magazine_disponible`, depuis le 2026-10-22) |
| Renvoyer l’email n°3 (sondage) | API seulement (`POST /invites/<id>/renvoi-email/` `{type: SONDAGE}`) | admin | refusé (`SONDAGE_INDISPONIBLE`) si le sondage est désactivé pour le programme, hors de sa fenêtre de 24 h ou si le dernier envoi n’est pas en échec (`sondages.sondage_renvoyable`) ; sinon nouvel envoi et journal `EMAIL_RENVOI`, **que l’invité ait répondu ou non** (réponse, journal et statut identiques : l’admin n’apprend pas qui a répondu ; `sondage_repondu` supprimé le 2026-10-22, `7e0e071`) ; pas de bouton dans la fiche — à confirmer s’il en faut un |
| Modifier la fiche | fiche | admin | PATCH, journalisé avec la liste des champs |
| Exporter (vue filtrée ou sélection) | barre / sélection | admin | CSV ou Excel ([exports](exports-rapports.md)) |
| Supprimer | fiche, sélection | **super admin** | définitif (emails, émargements) ; journal = nombre seulement |
| Ajouter un invité | « Ajouter un invité » (A6) | admin | source MANUEL, tous champs obligatoires, email n°1 optionnel |

Au-delà de **50 invités**, actions groupées et exports passent en tâche Celery (202 + `tacheId`, suivi par
`/taches/<id>/`, fichier à usage unique supprimé au téléchargement, purge après 6 h).

Sélection groupée : 5 000 identifiants au plus par requête (`ActionGroupeeSerializer.ids`).

## Fiche (A5)
Fiche, QR code (PNG servi par l’API, `Cache-Control: private`) et code de secours, historique complet
(inscription, chaque email — libellé `models.libelle_email`, email n°3 compris —, émargements, annulations, modifications), étape « En attente du passage ».

## Limites
- Modification : entreprise et fonction facultatives ([R3](../project/risques-et-dette.md)).
- Pas de verrou optimiste : deux admins qui modifient la même fiche en même temps → le dernier enregistrement
  l’emporte sans avertissement (R20).
- Serveur de développement (`runserver`) : la recherche `?q=` (souvent un email) apparaît en clair dans ses
  journaux ; en production, Gunicorn la masque (R24).
- Renvoi groupé : le toast n’affiche que `traites` (« Invitation renvoyée à 0 invité » si tous sont ignorés) ; le
  nombre d’`ignores` n’est pas montré à l’utilisateur.

## Tests
`test_invites.py` (compteurs, recherche, filtres et tris, ajout, modification et historique, actions groupées,
export CSV/XLSX, tâches > 50, neutralisation des formules, purge, renvoi groupé sans doublon < 1 h et limité par
heure, `test_renvoi_magazine_refuse_si_desactive`) ; `test_suppressions.py` ; `test_durcissement.py`
(`test_renvoi_du_sondage_ne_revele_pas_qui_a_repondu`) ; `test_sondage.py` (`test_suivi_et_renvoi_du_sondage` : renvoi individuel de l’email n°3 refusé hors fenêtre).
