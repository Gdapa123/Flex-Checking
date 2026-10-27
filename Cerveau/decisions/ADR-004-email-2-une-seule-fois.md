---
type: decision
statut: acceptée
verifie: 2026-10-27
commit: bed9942
sources: [PLAN.md, backend/apps/noyau/emails.py, backend/apps/noyau/services.py, backend/apps/noyau/suivi_emails.py, backend/apps/noyau/vues_invites.py, backend/apps/noyau/tests/test_emargement.py]
---

# ADR-004 — L’email n°2 (magazine) ne part qu’une fois par invité

- **Date** : 2026-10-09 (PLAN §6) ; règle durcie ensuite
- **Statut** : acceptée

## Contexte
Un invité peut être émargé, annulé (erreur d’hôte), puis émargé de nouveau ; plusieurs postes peuvent le scanner.

## Décision
`emails.magazine_deja_parti(invite)` : dès qu’**une** ligne `EmailEnvoye(type=MAGAZINE)` existe pour l’invité
(quel que soit son statut, y compris ÉCHEC définitif), l’email n°2 n’est plus déclenché automatiquement.
La vérification a lieu dans la transaction de `emarger`, sous verrou de la ligne de l’invité.
Le plan initial ne comptait que les statuts EN_ATTENTE et ENVOYE ; le code est plus strict.

## Conséquences
- ➕ jamais de doublon, même en cas de course ou de ré-émargement.
- ➖ un email n°2 en échec définitif ne repart pas tout seul : renvoi manuel depuis la fiche (« Renvoyer l’email n°2 »)
  ou, depuis `bd4f807`, renvoi groupé de l’écran A7 « Suivi des emails » (`suivi_emails.renvoyer_echecs` : invités
  dont le dernier email n°2 est en échec et encore Présents) ; ces renvois manuels ne passent pas par
  `magazine_deja_parti`, ce qui est conforme à la décision (seul le déclenchement automatique est bloqué). Depuis
  le 2026-10-22, le renvoi depuis la fiche exige aussi que le magazine soit disponible
  (`suivi_emails.magazine_disponible` : `magazine_actif` et `lien_magazine`), comme le renvoi groupé.

## Vérification (2026-10-26, `44eceb5` ; précédente 2026-10-21, `be899ff`)
Toujours appliquée : `services.emarger` appelle `emails.magazine_deja_parti` après le verrou `select_for_update` sur
l’invité. Test : `test_annulation_puis_reemargement_sans_second_magazine` (l’annulation y est désormais faite par
le super admin, voir [ADR-011](ADR-011-annulation-reservee-super-admin.md)) ; un même mécanisme « une seule fois »
existe pour l’email n°3 ([ADR-012](ADR-012-sondage-satisfaction.md)).
