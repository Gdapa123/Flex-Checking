---
type: operations
statut: partiel
verifie: 2026-11-09
commit: ebaf617
sources: [frontend/src/lib/schemas.js, frontend/src/features/scan/ScanPoste.jsx, backend/apps/noyau/validation.py, backend/apps/noyau/services.py, backend/apps/noyau/serializers.py, backend/templates/emails/invitation.html, backend/templates/emails/invitation.txt]
---

# Sécurité de l’accueil : QR codes malveillants

Fiche à remettre aux hôtes et à la personne qui prépare le matériel, avant chaque cérémonie.
Les protections **dans l’application** sont décrites dans [scan et émargement](../features/scan-emargement.md)
(section « QR codes étrangers ») et le risque dans [risques et dette](../project/risques-et-dette.md) (R28).

## Ce que l’application fait déjà ✅
- Le scanner de Flex’Checking **n’ouvre jamais** un QR code : un lien, un réseau Wi‑Fi ou un texte quelconque
  affiche « QR code non reconnu » et n’est ni envoyé au serveur, ni mis en file hors ligne, ni affiché.
- Vérifié dans Chromium (2026-11-09) avec une fausse caméra filmant un QR code piégé et avec une douchette simulée
  (`frontend/e2e/cameraQr.spec.js`, `frontend/e2e/parcours.spec.js`).
- L’écran « QR code non reconnu » joue le son et la vibration d’erreur et met la caméra en pause, comme un code
  invalide.
- Le serveur ne cherche en base qu’un contenu au format exact d’une invitation (32 caractères) ; tout le reste
  répond « code invalide ». Les caractères de contrôle sont refusés.
- Les QR codes d’invitation ne contiennent aucune donnée personnelle.

## Consignes aux hôtes (à lire au briefing) 📋
1. **Scanner uniquement avec Flex’Checking** (application installée sur l’écran d’accueil), jamais avec
   l’appareil photo du téléphone, Google Lens ou une autre application : elles ouvriraient un lien piégé.
2. Si l’écran affiche « QR code non reconnu » : **ne pas insister**, demander l’email d’invitation ou le code à
   4 chiffres, ou rechercher le nom.
3. Ne jamais toucher un lien, une notification ou une fenêtre qui apparaît pendant le scan ; ne jamais saisir son
   mot de passe ailleurs que sur la page de connexion de Flex’Checking.
4. Un invité qui présente un QR code imprimé ou envoyé par une autre personne : vérifier le nom affiché.
5. Signaler à la direction des événements tout QR code suspect (photo de l’écran, sans le scanner ailleurs).

## Préparer les douchettes (lecteurs USB) 📋
Une douchette se comporte comme un clavier : un QR code piégé peut lui faire « taper » des raccourcis, voire la
reprogrammer. À faire **une fois**, avec l’outil ou le manuel du fabricant :
- désactiver la **programmation par code-barres** (« configuration barcode », « programming mode ») ;
- désactiver l’envoi des **caractères de contrôle** et des **touches de fonction** (« Function key emulation »,
  « Control character output ») ; garder seulement le suffixe « Entrée » ;
- tester : un QR code contenant un lien doit afficher « QR code non reconnu », sans rien ouvrir.

Ordinateur d’accueil : session **sans droits d’administrateur**, seul le navigateur ouvert sur Flex’Checking,
mises à jour faites avant le jour J.

## Affiches d’inscription 📋
- Imprimer l’adresse en clair à côté du QR code (`inscription.mde.ci/...`).
- Avant l’événement, vérifier qu’**aucun autocollant** n’a été collé par-dessus le QR code.

## Faux emails d’invitation (« quishing ») 📋
- L’email n°1 rappelle désormais aux invités que le QR code sert uniquement à l’accueil, que MDE ne demande ni
  paiement ni mot de passe, et nomme le seul site officiel (`APP_PUBLIC_URL`).
- **À faire par l’administrateur du domaine `mde.ci`** : corriger SPF, activer DKIM, durcir DMARC, pour que les
  imitations arrivent en spam et que nos vrais emails soient acceptés. Constat DNS public du 2026-11-09 (`dig`) :
  - **SPF invalide** ❌ : l’enregistrement TXT de `mde.ci` contient un mot `spf1` isolé
    (`v=spf1 include:_spf.createsend.com spf1 include:spf.infomaniak.ch …`). Un mécanisme inconnu rend tout le SPF
    en erreur (`permerror`, RFC 7208) : les emails de `mde.ci`, dont `noreply@mde.ci`, peuvent être rejetés ou
    classés en spam. Correction : supprimer ce mot isolé. ❓ Lien avec les emails non reçus du 2026-11-06 à confirmer.
  - **DMARC** 🟡 : `p=none` (simple surveillance, aucune protection). Après correction de SPF et DKIM et quelques
    jours de rapports (`rua=mailto:dmarc@mde.ci`), passer à `p=quarantine`, puis `p=reject`.
  - **DKIM Google** ❓ : aucun enregistrement sous le sélecteur par défaut `google._domainkey` ; à activer dans la
    console Google Workspace (Applications › Gmail › Authentifier les e-mails) si `noreply@mde.ci` passe par Gmail.
  - MX : une entrée `ms16140530.msv1.invalid.` (reste d’une vérification Microsoft) est inutile et peut être retirée.
