---
type: decision
statut: acceptée
verifie: 2026-11-09
commit: 0941335
sources: [backend/apps/noyau/cartes_invitation.py, backend/apps/noyau/models.py, backend/apps/noyau/migrations/0013_carte_invitation.py, backend/apps/noyau/vues_admin.py, backend/apps/noyau/vues_public.py, backend/apps/noyau/ics.py, frontend/src/lib/carteInvitation.js, frontend/src/features/super/Evenements.jsx, backend/apps/noyau/tests/test_carte_invitation.py, frontend/e2e/carteInvitation.spec.js]
---

# ADR-016 — Carte d’invitation : fichier envoyé en JSON et stocké en base

- **Date** : 2026-11-09
- **Statut** : acceptée (demande de l’utilisateur : « c’est un fichier, pas un lien »)
- **Remplace / remplacée par** : remplace le champ « Lien de la carte d’invitation » du même jour (colonne
  `lien_carte_invitation` conservée et encore lue si aucun fichier, à supprimer plus tard, ADR-014)

## Contexte et problème
Le super admin fournit la carte d’invitation du programme (image ou PDF) ; elle est jointe à l’événement d’agenda
des invités. L’API n’accepte que du JSON (protection contre les formulaires multipart d’autres sites), le backend
de test sur Vercel n’a pas de disque permanent, et le VPS sauvegarde la base.

## Options étudiées
1. Envoi multipart et fichier sur disque (`MEDIA_ROOT`, volume `media-data` du VPS).
2. Stockage objet (Vercel Blob, S3).
3. Fichier en base64 dans le corps JSON, stocké en base (`BinaryField`, table à part).

## Critères de comparaison
- Fonctionne à l’identique sur le VPS et sur Vercel ; inclus dans les sauvegardes ; aucune exception à la règle
  « JSON uniquement » ; aucune dépendance nouvelle.

## Décision
Option 3. `PUT evenements/<id>/carte-invitation/` `{nom, contenu}`, 1,8 Mo au plus (corps sous la limite
`DATA_UPLOAD_MAX_MEMORY_SIZE` de 2,5 Mo et sous celle de Vercel). Format reconnu au contenu (JPEG, PNG, PDF) ;
images réencodées par Pillow (redressées selon l’orientation EXIF puis métadonnées retirées, profil de couleurs
gardé, 2400 px de côté au plus, qualité abaissée ou PNG converti en JPEG pour tenir dans 1,8 Mo, garde de 40 Mpx) ;
nom de fichier nettoyé, extension alignée sur le contenu. Côté navigateur, une image trop lourde ou de plus de
2400 px est réduite (JPEG). Fichier servi par `GET public/evenements/<slug>/carte-invitation/` avec
`Content-Security-Policy: sandbox`, `ETag` (304 sans relire le fichier), `Cache-Control: public, no-cache` ; image
affichée, PDF téléchargé (les lecteurs PDF refusent un document « sandbox »). L’ancien lien saisi
(`lien_carte_invitation`) est affiché comme carte et effacé dès qu’un fichier est envoyé ou retiré. Page publique
mise à jour aussitôt (`temps_reel._carte_invitation` : cache vidé, sujets `evenement`, `evenements`).

## Raisons
- Une seule solution pour toutes les installations, sauvegardée avec le reste.
- La règle « JSON uniquement » de l’API reste sans exception nouvelle.

## Conséquences
- ➕ Rien à configurer ; le fichier suit la cérémonie (supprimé avec elle).
- ➖ Taille limitée à 1,8 Mo (un PDF plus lourd doit être compressé avant envoi).
- ➖ La base grossit d’au plus 1,8 Mo par cérémonie.
