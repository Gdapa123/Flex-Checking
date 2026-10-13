---
type: decision
statut: acceptée
verifie: 2026-10-13
commit: dc0c75a
sources: [PLAN.md, backend/apps/noyau/emails.py, backend/apps/noyau/services.py, backend/apps/noyau/tests/test_emargement.py]
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
- ➖ un email n°2 en échec définitif ne repart pas tout seul : renvoi manuel depuis la fiche (« Renvoyer l’email n°2 »).
