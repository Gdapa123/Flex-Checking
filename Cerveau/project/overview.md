---
type: project
statut: implémenté
verifie: 2026-10-21
commit: be899ff
sources: [README.md, PLAN.md, frontend/src/App.jsx, backend/apps/noyau/urls.py, backend/apps/noyau/sondages.py, backend/apps/noyau/vues_scan.py]
---

# Présentation de Flex’Checking

Application d’émargement des cérémonies de graduation de **MDE Business School** (Abidjan, Côte d’Ivoire).

## Le parcours en une phrase
L’invité s’inscrit par un lien public → reçoit l’**email n°1** (QR code + code de secours à 4 chiffres + .ics) →
le jour J, un hôte scanne son QR code (ou saisit le code, ou le cherche par nom) → l’invité passe **Présent** →
il reçoit l’**email n°2** (lien du magazine de la promotion), une seule fois → le lendemain à 8 h, l’**email n°3**
(sondage de satisfaction, lien personnel valable 24 h, réponse anonyme) s’il est présent et que le programme a le
sondage activé (voir [sondage-satisfaction](../features/sondage-satisfaction.md)).

## Quatre espaces

| Espace | URL | Pour qui | Univers visuel | Page |
|---|---|---|---|---|
| Invité | `/i/<lien>` (+ `/confirmation`, `/pratique`), `/sondage/<jeton>` | public, mobile d’abord, sans compte | couleurs du programme | [inscription](../features/inscription.md), [sondage](../features/sondage-satisfaction.md) |
| Scan | `/scan`, `/scan/<id>` | hôtes d’accueil (téléphone, borne, ordinateur) | graphite + programme | [scan](../features/scan-emargement.md) |
| Admin | `/connexion` → `/admin` (`/admin/evenements/<id>/`, `invites`, `emails`) | admins des cérémonies affectées | couleurs du programme | [tableau de bord](../features/tableau-de-bord.md), [invités](../features/gestion-invites.md) |
| Super admin | `/super/connexion` → `/super` | direction des événements | univers MDE fixe (bordeaux, jaune) | [configuration](../features/configuration-super-admin.md) |

## Notions métier
- **Programme** : AMP, PMD, Public-AMP, Public-ASD (créés par migration), chacun avec deux couleurs qui
  thématisent ses écrans et emails.
- **Événement / cérémonie** : une édition annuelle d’un programme (« Graduation AMP 2026 », nom calculé, jamais stocké).
- **Invité** : statut `INSCRIT` ou `PRESENT`, code à 4 chiffres unique par événement, `qr_token` aléatoire unique.
- **Émargement** : passage à Présent, avec mode (QR caméra, douchette, code, manuel), poste et appareil ;
  annulable par un super admin seulement (la ligne est conservée ; voir
  [ADR-011](../decisions/ADR-011-annulation-reservee-super-admin.md)).

## Où lire la suite
- Architecture : [system-overview](../architecture/system-overview.md)
- Ce qui est dans / hors périmètre : [scope](scope.md)
- Points faibles connus : [risques-et-dette](risques-et-dette.md)
