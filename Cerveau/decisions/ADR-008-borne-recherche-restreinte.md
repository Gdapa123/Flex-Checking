---
type: decision
statut: acceptée
verifie: 2026-10-13
commit: dc0c75a
sources: [PLAN.md, frontend/src/features/scan/composants.jsx, frontend/src/features/scan/ScanPoste.jsx]
---

# ADR-008 — Recherche restreinte sur la borne libre-service

- **Date** : 2026-10-09 (PLAN Q4, proposition retenue)
- **Statut** : acceptée

## Contexte
Sur la borne, l’invité lui-même cherche son nom ; le design affichait tous les invités avec leur email.

## Décision
Sur la disposition « Borne » seulement : aucune liste avant 3 caractères saisis, email jamais affiché
(entreprise seule), bouton « C’est moi ». Téléphone et ordinateur (tenus par un hôte) gardent l’affichage complet.

## Conséquences
- ➕ limite l’exposition des données personnelles devant le public.
- ➖ la protection ne vaut que tant que l’invité reste sur l’écran de scan : l’accès hôte n’est pas verrouillé
  ([R1](../project/risques-et-dette.md)).
