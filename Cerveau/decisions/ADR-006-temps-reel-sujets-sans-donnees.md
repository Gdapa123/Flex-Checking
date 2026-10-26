---
type: decision
statut: acceptée
verifie: 2026-10-26
commit: 44eceb5
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
- ➖ nécessite un serveur ASGI et Redis ; sans Redis, pas de temps réel ([ADR-007](ADR-007-environnement-test-vercel.md)) :
  depuis `ffa45e4`, le serveur accepte puis ferme la connexion avec le code **4004** et le navigateur passe à l’état
  « indisponible » (interrogation périodique, nouvel essai silencieux toutes les 5 min).
- Mise en œuvre au 2026-10-21 : le principe est inchangé ; le sondage de satisfaction (`bd4f807`) a ajouté le sujet
  `sondage` (signaux sur `InvitationSondage` et `ReponseSondage`), toujours sans donnée personnelle. Détail :
  [temps-reel](../features/temps-reel.md).
- Au 2026-10-26 (`7e0e071`) : le message de service `session_fermee` (identifiant du jeton déconnecté, aucune
  donnée d’invité) ferme la seule connexion de la session déconnectée, sans remettre en cause le principe.
