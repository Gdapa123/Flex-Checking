---
type: decision
statut: acceptée
verifie: 2026-10-26
commit: 44eceb5
sources: [PLAN.md, frontend/src/features/scan/composants.jsx, frontend/src/features/scan/ScanPoste.jsx, backend/apps/noyau/vues_scan.py]
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
- ➖ à l’origine, la protection ne valait que tant que l’invité restait sur l’écran de scan : l’accès hôte n’était
  pas verrouillé ([R1](../project/risques-et-dette.md), marqué résolu le 2026-10-13). Corrigé par
  [ADR-010](ADR-010-mode-borne-serveur.md) (session restreinte côté serveur).

## Mise en œuvre (vérifiée au commit `44eceb5`)
- Navigateur : `composants.jsx` n’affiche aucune liste sous 3 caractères sur la borne et montre l’entreprise seule
  (« Particulier » à défaut) avec le bouton « C’est moi » ; téléphone et ordinateur affichent `entreprise · email`.
- Serveur (ajout de [ADR-010](ADR-010-mode-borne-serveur.md)) : la borne interroge
  `GET evenements/<id>/borne/recherche/` (`vues_scan.RechercheBorneView`) au lieu de la recherche complète :
  chaque mot ≥ 3 caractères (4 mots au plus), nom / prénom / entreprise seulement (pas de recherche par email),
  10 résultats, champs `id`, `choix`, `nomComplet`, `entreprise`, `statut`, `presentLe` ; 30 recherches/min par
  compte (`RechercheBorneThrottle`). La règle « 3 caractères » est donc désormais aussi vérifiée par le serveur.
