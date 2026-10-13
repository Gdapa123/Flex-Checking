---
type: feature
statut: implémenté
verifie: 2026-10-13
commit: dc0c75a
sources: [frontend/src/features/scan/fileHorsLigne.js, frontend/src/features/scan/ScanPoste.jsx, frontend/src/features/scan/useEvenementsScan.js, frontend/src/features/auth/RequireRole.jsx, frontend/src/features/auth/useMoi.js, backend/apps/noyau/services.py]
---

# Scan hors ligne

**Principe** : aucune validation locale ; le serveur reste l’arbitre. Un passage sans réseau est mis en file et
affiché « Enregistré, vérification à la reconnexion » (fond avertissement, icône wifiOff).

## Mécanisme
- File IndexedDB `flex-checking-scan` / store `file` (`{id, evenementId, payload, cree}`), index par événement.
- Mise en file si `navigator.onLine` est faux, si `fetch` échoue (TypeError) ou si le serveur répond ≥ 500.
- Synchronisation : à l’événement `online`, puis toutes les 15 s ; une seule à la fois par événement ; ordre
  chronologique.
  - succès → retiré de la file, historique et compteurs mis à jour, toast « N émargements synchronisés » ;
  - réseau, 401, 403, 429 → arrêt, nouvel essai plus tard ;
  - 5xx → conservé, on passe au suivant ;
  - autre 4xx → retiré (requête invalide).
- Le payload contient `dateClient` : l’heure de passage réelle est conservée côté serveur (≤ 12 h).
- L’idempotence serveur rend le rejeu sans risque ; l’email n°2 part à la synchronisation.
- Bandeau S10 : « Hors ligne » / « Reconnexion » avec le nombre en attente.

## Rester utilisable sans réseau
- `RequireRole` garde le **dernier compte connu** (`localStorage` `fc-moi`) sur `/scan` si `/auth/moi/` échoue
  pour une autre raison qu’un 401.
- `useEvenementsScan` garde la dernière liste des cérémonies (`fc-evenements-scan`), liée au compte mémorisé.
- Un 401 ou une déconnexion efface ces données.

## Limites
- Recherche par nom indisponible hors ligne (message dédié) ; QR et code fonctionnent.
- Une cérémonie jamais chargée sur l’appareil ne peut pas être ouverte hors ligne.

## Tests
`test_emargement.py::test_scan_hors_ligne_garde_date_client`, `test_synchronisation_hors_ligne_rejouee_idempotente` ;
`frontend/tests/garde.test.jsx` (dernier compte connu hors ligne).
