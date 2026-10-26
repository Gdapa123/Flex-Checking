---
type: decision
statut: acceptée
verifie: 2026-10-26
commit: 44eceb5
sources: [PLAN.md, README.md, backend/apps/noyau/vues_public.py, backend/apps/noyau/validation.py, frontend/src/lib/schemas.js, backend/apps/noyau/tests/test_inscription.py, backend/apps/noyau/tests/test_audit_securite.py, frontend/src/features/invite/EtatCarte.jsx]
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

## Mise en œuvre — renforcements (`bd4f807`)
- Adresses email **ASCII uniquement** (`validation.valider_email` et `schemas.champEmail`) : avec la collation MySQL
  insensible aux accents, une variante accentuée (« mdé.ci ») atteignait la même boîte tout en ayant ses propres
  compteurs de renvoi. Test : `test_inscription_et_renvoi_refusent_les_adresses_non_ascii`.
- Limite du renvoi du QR (`RenvoiEmailThrottle`, 3/h) indexée par **cérémonie** et non plus par lien : un lien
  régénéré (anciens liens toujours acceptés) ne multiplie plus la limite.
- Limites par IP de l’inscription et du renvoi (`LimiteIpPartagee`) partagées entre instances.

## Conséquences
- ➕ aucune énumération des inscrits par le formulaire public.
- ➖ l’écran I7 de `EtatCarte.jsx` n’est plus atteignable ([R2](../project/risques-et-dette.md)) ;
  `PLAN.md` (I7, C8) et le README (« L’écran … déjà inscrite est conservé ») décrivent encore l’ancien
  comportement (constaté le 2026-10-21, revérifié le 2026-10-26).
- ❓ à confirmer avec le responsable fonctionnel : le cahier des charges exigeait I7.
