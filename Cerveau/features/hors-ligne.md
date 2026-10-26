---
type: feature
statut: implémenté
verifie: 2026-10-26
commit: 44eceb5
sources: [frontend/tests/fileHorsLigne.test.js, backend/apps/noyau/tests/test_durcissement.py, frontend/src/features/scan/fileHorsLigne.js, frontend/src/features/scan/ScanPoste.jsx, frontend/src/features/scan/ScanSetup.jsx, frontend/src/features/scan/useEvenementsScan.js, frontend/src/features/auth/RequireRole.jsx, frontend/src/features/auth/useMoi.js, backend/apps/noyau/services.py, backend/apps/noyau/vues_scan.py, backend/apps/noyau/tests/test_emargement.py]
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
  - 403 `CHOIX_BORNE_INVALIDE` (« C’est moi » de borne refusé : jeton invalide, passage plus de 5 min après la
    recherche ou rejeu au-delà de 12 h) → retiré, on passe au suivant (2026-10-22) ;
  - réseau, 401, autre 403 (CSRF, droits retirés), 429 → arrêt, nouvel essai plus tard ;
  - 5xx → conservé, on passe au suivant ;
  - autre 4xx → retiré (requête invalide).
- Le payload contient `dateClient` : l’heure de passage réelle est conservée côté serveur (≤ 12 h).
- L’idempotence serveur rend le rejeu sans risque ; l’email n°2 part à la synchronisation. Un passage rejoué
  (plus de 120 s après coup) antérieur à une annulation de présence (comparaison à l’heure de l’appareil, rejeu
  de plus de 12 h compris) renvoie `ANNULE_DEPUIS` : l’invité n’est pas
  repassé présent ([scan-emargement](scan-emargement.md)).
- Bandeau S10 (`BandeauHorsLigne`) : « Hors ligne. La lecture continue… » / « Reconnexion. Synchronisation en
  cours · N émargements en attente ».
- **Purge** : à l’ouverture d’un poste, `fileHorsLigne.purgerAnciens` supprime les passages en file depuis plus de
  **7 jours** (cérémonie passée, compte retiré).
- **Déconnexion** : depuis la configuration (`ScanSetup`), si `compterTout()` (tous événements) est non nul, une
  confirmation prévient que N émargements attendent encore la synchronisation (ils restent sur l’appareil et
  partiront à la prochaine connexion).

## Rester utilisable sans réseau
- `RequireRole` garde le **dernier compte connu** (`localStorage` `fc-moi`) sur `/scan` si `/auth/moi/` échoue
  pour une autre raison qu’un 401.
- `useEvenementsScan` garde la dernière liste des cérémonies (`fc-evenements-scan`), liée au compte mémorisé et
  **réduite** aux champs du poste de scan (`id`, `nomAffiche`, `date`, `statut`, `tokens`, `nbInscrits`,
  `nbPresents` : ni hôtes affectés, ni lien d’inscription).
- Un 401 ou une déconnexion (`useMoi.oublierMoi`) efface ces données, ainsi que l’historique du poste en
  `sessionStorage` (`fc-scan-historique-*`, `fc-scan-dernier-*`).

## Limites
- Recherche par nom indisponible hors ligne (message dédié) ; QR et code fonctionnent.
- Une cérémonie jamais chargée sur l’appareil ne peut pas être ouverte hors ligne.
- Borne démarrée hors ligne : la session n’est pas restreinte côté serveur tant que le réseau n’est pas revenu
  (restriction retentée toutes les 15 s, voir [ADR-010](../decisions/ADR-010-mode-borne-serveur.md)).
- Un « C’est moi » de borne touché hors ligne reste accepté à la synchronisation : la validité de 5 min du jeton
  est mesurée à l’heure du passage (`dateClient`), pas à l’heure du rejeu (`vues_scan.choix_borne_valide`,
  `7e0e071`). Il n’est perdu (retiré de la file sans émarger) que si le passage a eu lieu plus de 5 min après la
  recherche ou si le rejeu dépasse 12 h : l’invité doit alors rescanner ou être validé par l’hôte. Le blocage de la
  file qu’il provoquait auparavant est corrigé (R13 résolu).
- Un passage rejoué plus de 12 h après coup est daté de l’heure serveur (fenêtre de `dateClient`).

## Tests
`test_emargement.py::test_scan_hors_ligne_garde_date_client`, `test_synchronisation_hors_ligne_rejouee_idempotente` ;
`test_durcissement.py::test_scan_hors_ligne_rejoue_apres_annulation`, `test_c_est_moi_touche_hors_ligne_puis_synchronise` ; `frontend/tests/garde.test.jsx` (dernier compte
connu hors ligne) ; `frontend/tests/fileHorsLigne.test.js` (retrait d’un `CHOIX_BORNE_INVALIDE` et rejeu des
suivants ; arrêt sur un autre 403). Pas de test automatisé de `purgerAnciens` ni de
l’avertissement à la déconnexion (vérifié : aucun test frontend ne les cite).
