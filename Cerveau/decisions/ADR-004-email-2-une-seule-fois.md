---
type: decision
statut: acceptée
verifie: 2026-11-10
commit: 93646d7
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
  le 2026-11-10, l’email n°2 part pour tout invité Présent, avec ou sans lien de magazine (boutons selon les liens) ;
  le renvoi n’exige plus que la présence (la condition `magazine_actif` + lien du 2026-10-22 est retirée).

## Vérification (2026-11-10, `93646d7` ; précédentes 2026-10-26, `44eceb5`, et 2026-10-21, `be899ff`)
Toujours appliquée : `services.emarger` appelle `emails.magazine_deja_parti` après le verrou `select_for_update` sur
l’invité. Test : `test_annulation_puis_reemargement_sans_second_magazine` (l’annulation y est désormais faite par
le super admin, voir [ADR-011](ADR-011-annulation-reservee-super-admin.md)) ; un même mécanisme « une seule fois »
existe pour l’email n°3 ([ADR-012](ADR-012-sondage-satisfaction.md)).

Au 2026-11-10 (`ebcfcf7`), la décision « une seule fois » est inchangée et seule condition du déclenchement
automatique : dans `services.emarger`, `if not emails.magazine_deja_parti(invite)` remplace l'ancienne condition
`programme.magazine_actif and programme.lien_magazine and …` ; `suivi_emails.magazine_disponible` est supprimé
(`RenvoiEmailView` n'exige plus que le statut Présent, `_verifier_disponible` ne bloque plus le n°2, bloc
`actif` toujours vrai dans le suivi). Le lien du magazine est celui de la cérémonie, à défaut du programme
(`Evenement.lien_magazine_effectif`, `8d7753a`) ; `Programme.magazine_actif` n'a plus d'effet. Tests :
`test_emargement.py::test_email_2_envoye_meme_sans_magazine` (remplace `test_magazine_inactif`) et
`test_invites.py::test_renvoi_magazine_possible_sans_lien_mais_pas_avant_la_presence` (409 `MAGAZINE_INDISPONIBLE`
avant la présence, 202 après, même sans lien). Le renvoi groupé (`renvoyer_echecs`) saute toujours les invités qui
ne sont plus Présents.
