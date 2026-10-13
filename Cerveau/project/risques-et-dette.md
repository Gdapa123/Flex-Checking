---
type: project
statut: implémenté
verifie: 2026-10-13
commit: dc0c75a
sources: [frontend/src/features/scan/ScanPoste.jsx, frontend/src/features/scan/composants.jsx, frontend/src/features/invite/EtatCarte.jsx, backend/apps/noyau/vues_public.py, frontend/src/features/invites/PanneauInvite.jsx, backend/apps/noyau/serializers.py, README.md]
---

# Risques, limitations et dette technique

Chaque entrée est une **observation vérifiée dans le code**, sauf mention « à confirmer ».

## R1 — Accès hôte de la borne non protégé (sécurité, moyen) — ✅ RÉSOLU le 2026-10-13
- **Constat** : sur la tablette borne (S11), le bouton cadenas « Espace hôte » appelle `outils.reglages`, qui
  ouvre directement `FeuilleReglages` — aucun code ni mot de passe. La feuille propose « Changer de cérémonie »
  et « Quitter le scan · tableau de bord » (`/admin/evenements/<id>`).
- **Conséquence** : un invité devant la borne peut atteindre l’espace admin avec la session de l’hôte connecté
  (liste des invités, emails, téléphones, exports).
- **Fichiers** : `frontend/src/features/scan/ScanPoste.jsx` (`DispositionBorne`, `outils.reglages`),
  `frontend/src/features/scan/composants.jsx` (`FeuilleReglages`).
- **Résolution** : mot de passe de l'hôte vérifié par le serveur, bouton retour bloqué, et surtout **session
  restreinte côté serveur** ([ADR-010](../decisions/ADR-010-mode-borne-serveur.md)) : même en tapant une adresse,
  le public n'obtient ni la liste des invités ni l'espace admin.

## R2 — Écran I7 « Cette adresse est déjà inscrite » inaccessible (dette, faible)
- **Constat** : `InscriptionView.post` intercepte `DEJA_INSCRIT` et renvoie la même réponse 201 qu’un succès
  (voir [ADR-005](../decisions/ADR-005-anti-enumeration-inscription.md)). Le frontend ne reçoit donc jamais ce
  code ; la branche `DEJA_INSCRIT` de `EtatCarte.jsx` n’est plus atteinte depuis le formulaire public.
- **Conséquence** : code mort ; `PLAN.md` (C8) et le README décrivent encore l’ancien comportement.
- **Statut** : ouvert (décider : supprimer la branche ou la conserver documentée).

## R3 — Règle « tous les champs obligatoires » non appliquée à la modification (cohérence, faible)
- **Constat** : inscription et ajout manuel exigent entreprise et fonction (`ChampsProfessionnelsObligatoires`,
  `schemaInviteComplet`). La modification d’une fiche (`ModificationInviteSerializer`, `schemaInvite`) les
  accepte vides, et l’interface les libelle « facultatif » (`PanneauInvite.jsx`).
- **Statut** : ouvert — à confirmer si c’est voulu.

## R4 — README en retard (documentation, faible)
- Annonce « 79 tests » pytest ; le dépôt contient 143 fonctions `test_*` (certaines paramétrées, donc plus de
  cas exécutés). Décrit encore l’écran I7 comme exigé.

## R5 — Tests backend dépendants de MySQL (outillage)
- `pytest` exige un MySQL joignable (`config/settings_test.py` garde la base MySQL). Sans Docker, aucun test
  backend ne s’exécute (constaté le 2026-10-13). Pas de repli SQLite.

## R6 — Environnement Vercel : temps de réponse du renvoi du QR (faible, test uniquement)
- Sans file d'attente, l'email est envoyé pendant la requête quand l'adresse est inscrite : le temps de réponse
  peut révéler l'inscription malgré le message identique. Sans incidence en production (envoi par Celery).

## Limitations assumées (documentées, non bugs)
- Statistiques et analyses calculées en Python sur toutes les lignes d’une cérémonie : adapté à quelques
  centaines d’invités, à surveiller au-delà (`statistiques.py`, `analytique.py`). Mis en cache 30 s et invalidé.
- Environnement Vercel : pas de temps réel, emails en une seule tentative, emails écrits dans les journaux
  (voir [ADR-007](../decisions/ADR-007-environnement-test-vercel.md)).
- Hors ligne au scan : aucune validation locale ; tout passage est « en attente » jusqu’à la synchronisation
  (voir [hors-ligne](../features/hors-ligne.md)).
- Recherche par nom indisponible hors ligne.
- Erreurs techniques : 5 000 signatures max (2 000 pour le navigateur), conservation 30 jours.
