---
type: decision
statut: acceptée
verifie: 2026-10-13
commit: dc0c75a
sources: [backend/apps/noyau/temps_reel.py, backend/apps/noyau/consumers.py, frontend/src/lib/tempsReel.js, README.md]
---

# ADR-006 — Temps réel par WebSocket : annonce de sujets, rechargement par l’API

- **Date** : 2026-10-12 (commit `b28f3c3`)
- **Statut** : acceptée — remplace l’interrogation toutes les 5 s comme mécanisme principal (elle reste en secours)

## Contexte
Le tableau de bord, la liste des invités et les postes de scan doivent refléter les passages en direct, pour
des dizaines d’écrans, sans exposer de données à un écran qui n’y a pas droit.

## Options
1. Interrogation périodique seule — simple, mais charge et latence.
2. WebSocket qui pousse les données — duplique les règles de droits côté diffusion, risque de fuite.
3. **WebSocket qui annonce des sujets ; le navigateur recharge par l’API REST.**

## Décision
Option 3 avec Django Channels + Redis : notifications regroupées et envoyées après commit, groupes par événement,
aucune donnée personnelle dans les messages ; repli automatique sur l’interrogation périodique.

## Conséquences
- ➕ une seule source de vérité des droits (l’API) ; 500 écrans notifiés en 0,09 s.
- ➖ chaque notification déclenche des requêtes (absorbées par les caches 30 s invalidés).
- ➖ nécessite un serveur ASGI et Redis ; sans Redis, pas de temps réel ([ADR-007](ADR-007-environnement-test-vercel.md)).
