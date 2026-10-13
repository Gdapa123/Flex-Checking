---
type: decision
statut: acceptée
verifie: 2026-10-13
commit: dc0c75a
sources: [PLAN.md, backend/apps/noyau/vues_public.py, backend/apps/noyau/tests/test_inscription.py, frontend/src/features/invite/EtatCarte.jsx]
---

# ADR-005 — L’inscription ne révèle pas si une adresse est déjà inscrite

- **Date** : 2026-10-12 (commit `bb226e9` « Sécurité : sessions révocables, mot de passe temporaire imposé, entrées durcies »)
- **Statut** : acceptée (implémentée et testée) — **remplace la décision C8 de `PLAN.md`**

## Contexte
PLAN C8 (2026-10-09) conservait l’écran I7 « Cette adresse est déjà inscrite » (exigé par le cahier des charges),
le renvoi du QR répondant toujours de la même façon. Cela permettait de vérifier si une personne était inscrite.

## Décision (constatée)
`InscriptionView.post` intercepte `DEJA_INSCRIT` et renvoie **la même réponse 201** qu’une inscription réussie
(avec les nom/prénom saisis). La vraie personne reçoit de nouveau son invitation, au plus 3 fois par heure
(`_renvoi_autorise`, clé hachée). Test : `test_deja_inscrit_meme_reponse_et_invitation_renvoyee`.

## Conséquences
- ➕ aucune énumération des inscrits par le formulaire public.
- ➖ l’écran I7 de `EtatCarte.jsx` n’est plus atteignable ([R2](../project/risques-et-dette.md)) ;
  `PLAN.md` et le README décrivent encore l’ancien comportement.
- ❓ à confirmer avec le responsable fonctionnel : le cahier des charges exigeait I7.
