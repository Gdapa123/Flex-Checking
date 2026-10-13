---
type: project
statut: implémenté
verifie: 2026-10-13
commit: dc0c75a
sources: [PLAN.md, git log]
---

# Feuille de route

## Historique (d’après `git log`)

| Date | Étape |
|---|---|
| 2026-10-09 | Phase 0 : `PLAN.md` validé. Premier commit (phases 1 à 6 : socle, super admin, invité, scan, admin, finition). Logos SVG. Écran de présentation, champs obligatoires, mots de passe hors dépôt. |
| 2026-10-12 | Temps réel WebSocket ; analyses et rapports PDF, montée en charge, résilience ; sécurité (sessions révocables, mot de passe temporaire imposé) ; environnement de test Vercel ; suppressions du super admin ; nouvel écran des cérémonies ; revue UX ; consentement ; magazine de la promotion, scan rapide. |
| 2026-10-13 | Création de ce wiki (`Cerveau/`). |

Toutes les phases prévues par `PLAN.md` §10 sont livrées. Le travail en cours est de la finition demandée au fil de l’eau.

## Prochaines étapes possibles (📋 propositions, aucune n’est décidée)
Issues des points relevés dans [risques-et-dette](risques-et-dette.md) :

1. ~~Protéger l’accès hôte de la borne — R1~~ : fait le 2026-10-13 (ADR-010).
2. Aligner la modification d’un invité sur la règle « entreprise et fonction obligatoires » — R3.
3. Retirer ou réaffecter l’écran I7 « adresse déjà inscrite », devenu inaccessible — R2.
4. Mettre à jour le README (nombre de tests, changement de C8).
5. ~~Suivi Git du coffre `Cerveau/`~~ : suivi depuis le 2026-10-13, `workspace*.json` ignoré.
