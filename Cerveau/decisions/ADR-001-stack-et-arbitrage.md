---
type: decision
statut: acceptée
verifie: 2026-10-13
commit: dc0c75a
sources: [PLAN.md]
---

# ADR-001 — Stack imposée et règle d’arbitrage design / cahier des charges

- **Date** : 2026-10-09 (validation de `PLAN.md`)
- **Statut** : acceptée

## Contexte
Le cahier des charges impose la stack ; le design (Claude Design) contredit le cahier des charges sur 26 points.

## Décision
1. Stack : Django 5 + DRF, MySQL 8, React 18 **en JavaScript** (pas TypeScript) + Vite. Ajouts retenus : Celery +
   Redis, Tailwind, TanStack Query/Table, Zod, ZXing, Recharts, PWA ; plus tard Django Channels (temps réel) et ReportLab (PDF).
2. **Arbitrage** : le cahier des charges l’emporte pour le métier, les données et la technique ; le design pour
   l’apparence. Les 26 contradictions sont tranchées dans `PLAN.md` §7 (C1–C26).

## Conséquences
- `PLAN.md` §7 est la référence des choix d’interprétation ; certaines entrées ont depuis évolué
  (C8 : voir [ADR-005](ADR-005-anti-enumeration-inscription.md)).
- Code et interface en français.
