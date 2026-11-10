---
type: decision
statut: acceptée
verifie: 2026-11-10
commit: 93646d7
sources: [backend/apps/noyau/emails.py, backend/apps/noyau/vues_public.py, backend/apps/noyau/icones_email.py, backend/apps/noyau/urls.py, backend/templates/emails/base.html, backend/templates/emails/invitation.html, backend/apps/noyau/tests/test_corrections_invitation.py]
---

# ADR-015 — Logo et icônes des emails servis par lien ; deux pièces jointes seulement

- **Date** : 2026-11-09
- **Statut** : acceptée (demande de l’utilisateur : « seulement 2 éléments en pièces jointes : le code QR et le fichier ics »)
- **Remplace / remplacée par** : —

## Contexte et problème
L’email n°1 intégrait une dizaine d’images en CID (logo, icônes du calendrier, de l’horloge, du lieu, des boutons,
QR code), chacune avec un nom de fichier. Certaines messageries les présentent comme autant de pièces jointes, en
plus de `qr-code.png` et `graduation.ics`.

## Options étudiées
1. Garder les images intégrées sans nom de fichier : comportement variable selon les messageries, non garanti.
2. Supprimer logo et icônes : email appauvri, contraire au design.
3. Servir logo et icônes par lien HTTPS depuis l’application, garder seulement le QR code intégré.

## Critères de comparaison
- Nombre de pièces jointes visibles ; affichage si les images distantes sont bloquées ; aucune donnée personnelle
  dans les URL ; coût serveur.

## Décision
Option 3 : `emails.url_image_publique` → `GET /api/public/emails/images/<nom>.png` (`vues_public.ImageEmailView`),
noms fermés (`logo-blanc-<empreinte>`, `logo-rouge-<empreinte>` : `emails.nom_logo`, l’empreinte change avec le fichier pour ne pas rester un an en cache ; `ic-<icône connue>-<RRGGBB>` avec une couleur d’un programme ou des gabarits seulement, `vues_public.couleurs_des_emails`), limite de débit propre `images_email` (3000/min) pour ne pas épuiser la limite anonyme partagée avec l’inscription, `Cache-Control: public, max-age=31536000,
immutable`. Le QR code reste intégré (CID, sans nom de fichier) pour rester lisible hors ligne ; il est aussi joint
(`qr-code.png`) avec `graduation.ics`. L’aperçu (super admin, A7) garde des data URI.

## Raisons
- Seuls les deux fichiers utiles apparaissent en pièces jointes.
- Les URL ne contiennent ni identifiant ni donnée d’invité ; les relais d’images (Gmail, Apple) les mettent en cache.

## Conséquences
- ➕ Message plus léger (une seule image intégrée).
- ➖ Une messagerie qui bloque les images distantes (Outlook de bureau par défaut) affiche le texte de remplacement
  du logo et masque les icônes ; le contenu reste lisible.
- ➖ Les images dépendent de la disponibilité de l’application (`APP_PUBLIC_URL`) : un email ancien ouvert alors
  que le domaine a changé perd ses icônes.

## Vérification (2026-11-10, `93646d7`)
La décision est conforme au code committé (`8d7753a`, `40d0682`) : `emails.url_image_publique`, `emails.nom_logo`
(empreinte SHA-256 de 8 caractères), image intégrée sans nom de fichier (`Content-Disposition: inline`), QR code seul
en CID ; `vues_public.ImageEmailView` (motif `IMAGE_EMAIL`, icônes de `icones_email.ICONES_EMAIL`, couleurs de
`couleurs_des_emails` mises en cache 60 s, logo actuel servi pour une empreinte périmée), `ImageEmailThrottle`
(portée `images_email`) ; test `test_corrections_invitation.py`. Depuis, l'email n°2 (`magazine.html`,
`ebcfcf7`) emploie les mêmes icônes par lien (badge « Présent » `check`, bouton « Lire le magazine » `external` ;
le bouton brochure n'a pas d'icône).
