---
type: api
statut: implémenté
verifie: 2026-10-13
commit: dc0c75a
sources: [backend/apps/noyau/urls.py, backend/config/urls.py, backend/apps/noyau/vues_public.py, backend/apps/noyau/vues_scan.py, backend/apps/noyau/vues_invites.py, backend/apps/noyau/vues_admin.py, backend/apps/noyau/vues_erreurs.py, backend/apps/comptes/views.py]
---

# Points d’accès de l’API

Préfixe `/api/`. JSON en **camelCase** (converti automatiquement ; Python en snake_case). Schéma OpenAPI :
`/api/schema/`, Swagger : `/api/docs/` (super admin). Erreurs métier : `{code, detail}` (`ErreurMetier`, 409 par
défaut) ; 429 → `TROP_DE_TENTATIVES` ; 500 → `ERREUR_SERVEUR` (message neutre).

Légende droits : **P** public · **A** admin ou super admin (périmètre limité aux cérémonies affectées) · **S** super admin ·
**(borne)** accessible aussi à une session borne libre-service ; toute autre route lui est refusée (403). Corps de requête
en JSON uniquement (415 sinon).
`/api/sante/` (GET/HEAD) est servi par un middleware, avant tout contrôle.

## Authentification (`apps/comptes/views.py`)
| Méthode | Route | Droits | Détail |
|---|---|---|---|
| GET | `auth/csrf/` | P | pose le cookie CSRF (204) |
| POST | `auth/connexion/` | P (CSRF exigé) | `{email, motDePasse}` (email ASCII) → profil + cookies |
| POST | `auth/rafraichir/` | P (cookie refresh) | rotation, 204 ou 401 `SESSION_EXPIREE` |
| POST | `auth/deconnexion/` | P | liste noire du refresh, cookies effacés |
| GET | `auth/moi/` | connecté | `{id, nom, email, role, initiales, doitChangerMotDePasse}` |
| POST | `auth/mot-de-passe/` | connecté (pas en borne) | `{actuel, nouveau}` → nouvelles sessions ; 5/min, 30/h par compte |
| POST | `auth/verifier-mot-de-passe/` | connecté (borne comprise) | `{motDePasse}` → 204 (session complète si borne) ou 400 `MOT_DE_PASSE_INCORRECT` ; 5/min, 30/h par compte |
| POST | `auth/borne/` | connecté | passe la session en mode borne (204) |

## Public (`vues_public.py`, sans authentification)
| Méthode | Route | Détail |
|---|---|---|
| GET | `public/evenements/<slug>/` | infos, tokens de couleur, agenda UTC, `magazineActif`, `etat` ; 404 lien invalide ; ancien lien → `etat: FERME` |
| POST | `public/evenements/<slug>/inscription/` | 201 `{invite:{civilite, civiliteAffichee, prenom, nom, statut}}` (aussi pour un doublon) ; 409 `FERME/DATE_LIMITE/COMPLET` ; 400 validation |
| POST | `public/evenements/<slug>/renvoi-qr/` | `{email}` → 202 message toujours identique |
| GET | `public/evenements/<slug>/agenda.ics` | fichier iCalendar |
| POST | `erreurs/` | signalement d’erreur navigateur → 204 |

## Scan (`vues_scan.py`)
| Méthode | Route | Droits | Détail |
|---|---|---|---|
| POST | `evenements/<id>/emargement/` | A | exactement un de `qrToken`, `code`, `inviteId` + `mode`, `poste`, `appareil`, `dateClient` → `{resultat, invite, presentLe, poste, mode, evenementAutre, magazineEnvoye, emargementId, presents, inscrits}` |
| POST | `emargements/<id>/annulation/` | A | `{motif}` → `{resultat: ANNULE, inviteId, nomComplet, presents, inscrits}` |
| GET | `evenements/<id>/emargements/recents/` | A | 30 derniers passages + compteurs |
| GET | `parametres/scan/` | A (borne) | durée, son, vibration |
| GET | `evenements/<id>/borne/recherche/` | A (borne) | `q` : mots de 3 caractères ou plus (nom, prénom, entreprise ; les mots plus courts sont ignorés), 30/min par compte → `{total, resultats:[{id, nomComplet, entreprise, statut, presentLe}]}`, 10 max |

## Invités (`vues_invites.py`)
| Méthode | Route | Droits | Détail |
|---|---|---|---|
| GET | `evenements/<id>/invites/` | A | `q, statut, mode, magazine, email1, tri, page, taille` → `{total, page, pages, taille, compteurs:{tous, inscrits, presents, aRenvoyer}, resultats}` |
| POST | `evenements/<id>/invites/` | A | ajout manuel (+ `envoyerInvitation`) |
| POST | `evenements/<id>/invites/actions-groupees/` | A (SUPPRIMER : S) | `{action: VALIDER/RENVOYER/EXPORTER/SUPPRIMER, ids, tous, format}` ; > 50 → 202 `{tacheId, nb}` |
| GET | `evenements/<id>/invites/export/` | A | `format=xlsx|csv` + filtres |
| GET | `invites/` | S | tous les invités (+ `evenement`, `programme`) |
| GET | `invites/export/` | S | export de tous les invités |
| GET, PATCH, DELETE | `invites/<id>/` | A (DELETE : S) | fiche, modification, suppression |
| GET | `invites/<id>/qr.png` | A | QR PNG |
| POST | `invites/<id>/renvoi-email/` | A | `{type: INVITATION|MAGAZINE}` → 202 |
| GET | `invites/<id>/historique/` | A | événements datés |
| POST | `invites/<id>/presence/` | A | valider (MANUEL) |
| POST | `invites/<id>/presence/annulation/` | A | annuler la présence |
| GET | `taches/<id>/`, `taches/<id>/fichier/` | propriétaire | état, téléchargement unique |

## Configuration (`vues_admin.py`)
| Méthode | Route | Droits | Détail |
|---|---|---|---|
| CRUD | `programmes/` | lecture A, écriture S | DELETE `?confirmation=<nom>` s’il a des cérémonies (cascade) |
| CRUD | `evenements/` | lecture A, écriture S | DELETE `?confirmation=<nom affiché>` s’il a des invités |
| POST | `evenements/<id>/regenerer-slug/` | S | nouveau lien, l’ancien devient `AncienSlug` |
| GET | `evenements/<id>/qr-inscription.png` | S | QR du lien d’inscription (action hors de la liste « lecture » de `EvenementViewSet.get_permissions`) |
| GET | `evenements/<id>/statistiques/` | A | tableau de bord (cache 30 s) |
| GET | `evenements/<id>/rapport/` | A | PDF (30/h) |
| GET | `evenements/<id>/apercu-emails/` | A | HTML des deux emails avec données fictives |
| CRUD | `admins/` | S | POST renvoie `motDePasseTemporaire` une fois |
| POST | `admins/<id>/reinitialiser-mot-de-passe/` | S | nouveau mot de passe temporaire, sessions fermées |
| GET, PATCH | `parametres/` | S | modèles d’emails, scan |
| POST | `parametres/apercu-email/` | S | `{type, objet, corps, programme}` → `{objet, html, texte}` |
| GET | `journal/` | S | `auteur` (id ou `systeme`), `categorie`, `action`, `du`, `au`, `page` (50) |
| GET | `comptes/` | S | liste courte (filtre auteur) |
| GET | `exports/<invites|presences|emails|journal>/` | S | `format`, `evenement`, `programme` |
| GET | `analytique/`, `analytique/technique/`, `rapports/global/` | S | analyses, indicateurs, PDF |
| GET | `erreurs-techniques/` | S | `statut=a_traiter|resolues|toutes`, `source`, `page` (30) |
| PATCH | `erreurs-techniques/<id>/` | S | `{resolue}` |
| POST | `erreurs-techniques/actions/` | S | `{action: resoudre_tout|supprimer_resolues}` |

## WebSocket
`/api/ws/` : canal descendant uniquement ; messages `{type: "pret"}`, `{type: "maj", sujets, evenements}` ;
fermetures 4001 (session) et 4003 (compte). Voir [temps-reel](../features/temps-reel.md).
