---
type: feature
statut: implémenté
verifie: 2026-10-22
commit: be899ff
sources: [backend/apps/noyau/serializers.py, backend/apps/noyau/tests/test_durcissement.py, backend/apps/noyau/services.py, backend/apps/noyau/vues_scan.py, backend/apps/noyau/vues_admin.py, backend/apps/comptes/permissions.py, frontend/src/features/scan/ScanSetup.jsx, frontend/src/features/scan/ScanPoste.jsx, frontend/src/features/scan/composants.jsx, frontend/src/features/scan/useCamera.js, frontend/src/features/scan/reglages.js, frontend/src/features/scan/retour.js, frontend/src/features/auth/useMoi.js, backend/apps/noyau/tests/test_emargement.py, backend/apps/noyau/tests/test_audit_securite.py]
---

# Scan et émargement

**Utilisateurs** : hôtes d’accueil (comptes `ADMIN` affectés à la cérémonie, ou super admin).
**Univers** : graphite, accents du programme. PWA (`start_url: /scan`), écran maintenu allumé (Wake Lock).

## Configuration (S1, `/scan`)
Quatre étapes numérotées : **1 Cérémonie** (du jour et à venir, `?evenement=` présélectionne), **2 Mode de lecture**
(QR caméra, douchette, code 4 chiffres, manuel ; chaque carte a une ligne d’aide), **3 Écran** (Auto, Téléphone,
Borne, Ordinateur, en cartes avec icône et aide ; remplacé par une note si le mode est la douchette),
**4 Nom du poste** (texte libre ; suggestions « Accueil principal », « Accueil 2 », « Accueil 3 », « Entrée VIP »).
**Plusieurs postes en parallèle** sont possibles et utiles (files multiples au pic d’arrivée, entrées distinctes) :
le nom du poste alimente « Arrivées par poste » du tableau de bord et l’historique de l’invité. Les anciennes
suggestions « Borne 1 / Borne 2 / Poste ordinateur » ont été retirées le 2026-10-14 : elles se confondaient avec
le réglage « Écran ».
Réglages mémorisés sur l’appareil (`localStorage` `fc-scan-reglages`). Détection auto : < 640 px → téléphone ;
tactile < 1280 px → borne ; sinon ordinateur. Le mode douchette force l’ordinateur.
La disposition est **figée au démarrage du poste** (une rotation ou un redimensionnement ne fait pas quitter la
borne) et imposée à « Borne » tant que `auth/moi/` renvoie `borne: true`.
« Se déconnecter » depuis la configuration avertit (`window.confirm`) s’il reste des émargements hors ligne non
synchronisés sur l’appareil (`fileHorsLigne.compterTout`).

## Dispositions (`/scan/<id>`)
| Disposition | Particularités |
|---|---|
| Téléphone (S2) | caméra plein écran, compteur présents / inscrits, barre Code · Rechercher · Annuler (super admin seulement) · Torche · Caméra, « Dernier » passage |
| Borne (S11) | « Présentez votre QR code », gros boutons « Saisir mon code » et « Rechercher mon nom », « C’est moi ». **Session restreinte côté serveur** ([ADR-010](../decisions/ADR-010-mode-borne-serveur.md)) ; recherche par `GET evenements/<id>/borne/recherche/` (`vues_scan.RechercheBorneView`) : nom, prénom, entreprise, ≥ 3 caractères vérifiés par le serveur, 10 résultats, sans email/téléphone/code, chaque résultat portant un jeton signé `choix` ([ADR-008](../decisions/ADR-008-borne-recherche-restreinte.md)). « C’est moi » envoie `inviteId` + `choixBorne` : sans jeton valide (5 min, lié au compte, à la cérémonie et à l’invité) → 403 `CHOIX_BORNE_INVALIDE` ; 12 émargements manuels/min par compte et cérémonie en session borne (429). La liste des cérémonies y est réduite (`EvenementBorneSerializer` : ni hôtes ni lien d’inscription). Cadenas « Espace hôte » : mot de passe de l'hôte vérifié par le serveur avant les réglages ; bouton retour bloqué (entrée d'historique répétée) ; dès que l'hôte quitte son espace (réglages, annulation…), la session redevient restreinte ; espace hôte refermé après 90 s sans interaction ; restriction retentée toutes les 15 s et au retour du réseau, badge « Session non restreinte · reconnexion au serveur… » au-delà de 5 s. Recherche : chaque mot ≥ 3 caractères, 30 recherches/min par compte. En session borne, démarrer un autre type de poste depuis la configuration exige le mot de passe ; un refus du serveur au passage en mode borne bloque le démarrage (seule une coupure réseau le permet) |
| Ordinateur (S12) | douchette (champ toujours focalisé, accepte aussi un code à 4 chiffres) ou webcam, panneau de résultat, historique « Derniers passages » (session) |

## Règle serveur (`services.emarger`) — atomique et idempotente
1. Verrou `select_for_update` **sur la seule ligne de l’invité, sans jointure** (sous Postgres, une jointure
   faisait disparaître la ligne pour les scans concurrents).
2. Recherche par `qr_token` (tous événements), `code` (cet événement) ou `invite_id` (cet événement).
3. Résultats :
   - `AUTRE_EVENEMENT` : QR d’un invité d’une autre cérémonie (nom de l’autre cérémonie renvoyé, pas l’invité) ;
   - `CODE_INVALIDE` ;
   - `DEJA_EMARGE` : heure, poste et mode du premier passage non annulé ;
   - `ANNULE_DEPUIS` (2026-10-22) : scan **rejoué** (`date_client` antérieure de plus de 120 s à l’heure serveur)
     alors qu’une présence de l’invité a été annulée **après** ce passage : l’annulation l’emporte, l’invité n’est
     pas repassé présent. Affiché « Présence annulée depuis ce scan » (`ScanPoste.presenterResultat`), style
     avertissement et badge d’historique « Annulé depuis » (`composants.STYLES_RESULTAT`, `BADGES_HISTORIQUE`),
     son et vibration d’erreur (`retour.signaler`) ;
   - `PRESENT` : statut, `present_le`, `mode_emargement`, ligne `Emargement`, journal, email n°2 éventuel.
4. Heure de passage : `date_client` si elle est entre −12 h et +2 min de l’heure serveur (scans hors ligne),
   sinon l’heure serveur.
5. Réponse avec les compteurs `presents` / `inscrits`.

## Anti-force brute sur les codes
30 codes **invalides** en 10 min par compte et par cérémonie → 429 (compteur partagé via `CacheDeSecours`) ;
**10** en session borne (`MAX_CODES_INVALIDES_BORNE`, 2026-10-22 : le public tape les codes lui-même). Risque
résiduel (codes à 4 chiffres devinables) : R19 de [risques-et-dette](../project/risques-et-dette.md).
Le nom du `poste` est refusé s’il contient un caractère de contrôle (`EmargementRequeteSerializer.validate_poste`).
Chaque essai est compté **avant** l'émargement (incrément atomique : des requêtes parallèles ne passent pas toutes),
puis retiré s'il était valide : les codes valides ne bloquent jamais. Le poste, choisi par le client, n’entre pas
dans la clé.

## Annulation
**Super admin uniquement** ([ADR-011](../decisions/ADR-011-annulation-reservee-super-admin.md)) : les commandes
d’annulation sont masquées aux admins et le serveur leur répond 403.
`POST /emargements/<id>/annulation/` (feuille « Annuler le dernier ») : la ligne est conservée avec
`annule_le`, `annule_par`, motif (caractères de contrôle refusés) ; l’invité repasse INSCRIT. L’email n°2 déjà parti n’est pas rappelé.

## Zone de visée (`CadreVisee`)
Taille adaptative à l'écran, vidéo assombrie autour du cadre (`voile`) pour guider le geste :
| Disposition | Côté du cadre |
|---|---|
| Téléphone | `min(82vw, 50dvh, 440px)` (≈ 320 px sur un iPhone, contre 236 px avant) |
| Borne | `min(38vw, 56dvh, 560px)` (vidéo de même taille, contre 380 px fixes) |
| Ordinateur (webcam) | `min(30vw, 36dvh, 340px)` dans une zone vidéo de `min(44dvh, 420px)` de haut (réduits par `bd4f807`, depuis `min(30vw, 44dvh, 380px)` dans `min(56dvh, 480px)`, pour laisser la place au panneau de résultat) |
La lecture ZXing porte sur toute l'image de la caméra : le cadre guide l'invité, il ne limite pas la détection.

## Affichage du résultat (S4)
Plein écran (téléphone, borne) ou panneau (ordinateur), couleur par résultat (succès, avertissement, erreur),
barre de progression, retour automatique après 2/3/5 s, pause au toucher, `aria-live="assertive"`. Le panneau de
l’ordinateur (`ResultatPanneau`) est un bouton accessible au clavier (Entrée / Espace : pause ou reprise) ; le nom
s’affiche en `clamp(34px, 3.6vw, 52px)`.
Historique « Derniers passages » et « Dernier » en `sessionStorage` (`fc-scan-historique-<id>`,
`fc-scan-dernier-<id>`), effacés par `useMoi.oublierMoi` à la déconnexion (tablette partagée).
Son (Web Audio) et vibration désactivables ; valeurs globales (Paramètres) surchargées par l’appareil.
Anti-rebond caméra : même QR ignoré pendant 3 s ; caméra en pause pendant le résultat.

## États de la caméra (S9)
autorisation, refus, aucune caméra, caméra occupée, erreur — chacun avec des alternatives (code, recherche, douchette).

## Hors ligne
Voir [hors-ligne](hors-ligne.md).

## Tests
`test_emargement.py` (idempotence, invalide, autre événement, `test_annulation_reservee_au_super_admin`,
annulation par le super admin sans second magazine, hors ligne, limitation des codes, concurrence) ;
`test_audit_securite.py` (recherche réduite de la borne, `test_borne_emarge_seulement_un_nom_propose_par_la_recherche`,
`test_borne_ne_voit_ni_hotes_ni_lien_d_inscription`) ; `test_durcissement.py` (`test_borne_limite_les_codes_tires_au_hasard`,
`test_scan_hors_ligne_rejoue_apres_annulation`) ; `frontend/tests/resultat.test.jsx`.

## Limites
- La borne reste un poste public : un invité peut émarger quelqu'un d'autre avec « C’est moi » (inhérent au
  libre-service ; l'hôte annule depuis son espace). Mode kiosque de l'appareil recommandé (accès guidé iOS,
  épinglage d'écran Android).
