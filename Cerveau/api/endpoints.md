---
type: api
statut: implémenté
verifie: 2026-10-22
commit: be899ff
sources: [backend/apps/noyau/urls.py, backend/config/urls.py, backend/apps/noyau/vues_public.py, backend/apps/noyau/vues_scan.py, backend/apps/noyau/vues_invites.py, backend/apps/noyau/vues_admin.py, backend/apps/noyau/vues_erreurs.py, backend/apps/noyau/vues_sondage.py, backend/apps/noyau/sondages.py, backend/apps/noyau/suivi_emails.py, backend/apps/noyau/serializers.py, backend/apps/comptes/views.py, backend/apps/comptes/throttles.py, backend/config/settings.py, backend/vercel.json]
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
| POST | `auth/connexion/` | P (CSRF exigé) | `{email, motDePasse}` (email ASCII) → profil + cookies ; limites 5/min par IP et email, 30/min par IP (`LIMITE_CONNEXION_IP`), 20 échecs/h par compte ; un **poste connu** (cookie signé `fc_poste`, 90 jours, posé à chaque connexion réussie) a son propre compteur de 20 échecs/h (`cle + ":poste-connu"`, 2026-10-22) |
| POST | `auth/rafraichir/` | P (cookie refresh, CSRF exigé) | rotation sous verrou (`select_for_update` sur le jeton : deux rafraîchissements simultanés n’ouvrent pas deux sessions), 204 ou 401 `SESSION_EXPIREE` (cookies effacés) ; **409 `SESSION_DEJA_RENOUVELEE`** sans effacer les cookies si le jeton, authentique, a été révoqué il y a moins de 30 s par une rotation (autre onglet, `_renouvele_par_un_autre_onglet`) |
| POST | `auth/deconnexion/` | P | liste noire du refresh, jeton d’accès révoqué, notification `perimetre` au groupe du compte (le WebSocket de cette session est fermé en 4001), cookies effacés |
| GET | `auth/moi/` | connecté | `{id, nom, email, role, initiales, doitChangerMotDePasse}` |
| POST | `auth/mot-de-passe/` | connecté (pas en borne) | `{actuel, nouveau}` (≤ 256 caractères, nouveau ≥ 10) → nouvelles sessions ; 5/min, 30/h par compte |
| POST | `auth/verifier-mot-de-passe/` | connecté (borne comprise) | `{motDePasse}` → 204 (session complète si borne) ou 400 `MOT_DE_PASSE_INCORRECT` ; 5/min, 30/h par compte |
| POST | `auth/borne/` | connecté | passe la session en mode borne (204) |

## Public (`vues_public.py`, sans authentification)
| Méthode | Route | Détail |
|---|---|---|
| GET | `public/evenements/<slug>/` | infos, tokens de couleur, agenda UTC, `magazineActif`, `etat` ; 404 lien invalide ; ancien lien → `etat: FERME` |
| POST | `public/evenements/<slug>/inscription/` | 201 `{invite:{civilite, civiliteAffichee, prenom, nom, statut}}` (aussi pour un doublon) ; 409 `FERME/DATE_LIMITE/COMPLET` ; 400 validation |
| POST | `public/evenements/<slug>/renvoi-qr/` | `{email}` → 202 message toujours identique ; limite par email comptée **par cérémonie** (un ancien lien ne la multiplie pas) |
| GET | `public/evenements/<slug>/agenda.ics` | fichier iCalendar |
| GET | `public/sondages/<jeton>/` (`vues_sondage.py`) | `{etat: OUVERT/EXPIRE/REPONDU, prenom, civilite, expireLe, evenement:{nomAffiche, programme, annee, date, tokens}}` (`prenom` et `civilite` vides si le lien n’est plus ouvert) ; `Cache-Control: no-store` ; pose le cookie httpOnly `fc_appareil` (30 jours, chemin `/api/public/sondages/`) ; 404 lien inconnu ; 60/h par IP |
| POST | `public/sondages/<jeton>/` | `{noteGlobale 1-5, noteAccueil 1-5, recommandation 0-10, commentaire? (≤ 1 000, caractères de contrôle refusés sauf sauts de ligne et tabulation), appareil? (16-64 car. `[A-Za-z0-9_-]`)}` → 201 `{etat: REPONDU}` ; 410 `SONDAGE_EXPIRE` ; 409 `DEJA_REPONDU` / `APPAREIL_DEJA_UTILISE` ; 400 (dont cookie et `appareil` tous deux absents) |
| GET | `public/confidentialite/` (`vues_public.ConfidentialiteView`) | `{contact, dureeConservationMois}` pour la page `/confidentialite` ; public, limite anonyme par défaut (voir [donnees-personnelles](../features/donnees-personnelles.md)) |
| GET | `taches-planifiees/sondages/` | cron Vercel (`backend/vercel.json` : `?passage=8h` à 8 h et `?passage=12h` à 12 h ; le paramètre n’est pas lu par la vue, il distingue seulement les deux chemins), en-tête `Authorization: Bearer <CRON_SECRET>` → `{programmes, envoyes, anonymisation: {evenements, invites}}` (`sondages.planifier_sondages` puis `donnees_personnelles.anonymiser_donnees_expirees`) ; 404 si secret absent, de moins de 32 caractères ou différent ; aucune limite de débit |
| POST | `erreurs/` | signalement d’erreur navigateur → 204 |

## Scan (`vues_scan.py`)
| Méthode | Route | Droits | Détail |
|---|---|---|---|
| POST | `evenements/<id>/emargement/` | A (borne) | exactement un de `qrToken`, `code`, `inviteId` + `mode`, `poste`, `appareil`, `dateClient`, `choixBorne` → `{resultat, invite, presentLe, poste, mode, evenementAutre, magazineEnvoye, emargementId, presents, inscrits}` ; `resultat` ∈ `PRESENT`, `DEJA_EMARGE`, `CODE_INVALIDE`, `AUTRE_EVENEMENT`, `ANNULE_DEPUIS` (scan rejoué antérieur à une annulation) ; `poste` sans caractère de contrôle ; codes invalides : 30 / 10 min par compte et cérémonie, **10 en session borne** (429) ; en borne, `inviteId` exige le jeton signé `choixBorne` rendu par la recherche (5 min, sinon 403 `CHOIX_BORNE_INVALIDE`) et 12 passages manuels/min (429) |
| POST | `emargements/<id>/annulation/` | S | `{motif}` (sans caractère de contrôle) → `{resultat: ANNULE, inviteId, nomComplet, presents, inscrits}` |
| GET | `evenements/<id>/emargements/recents/` | A | 30 derniers passages + compteurs |
| GET | `parametres/scan/` | A (borne) | durée, son, vibration |
| GET | `evenements/<id>/borne/recherche/` | A (borne) | `q` : mots de 3 caractères ou plus (nom, prénom, entreprise ; les mots plus courts sont ignorés), 30/min par compte → `{total, resultats:[{id, choix, nomComplet, entreprise, statut, presentLe}]}`, 10 max (`choix` : jeton signé à renvoyer en `choixBorne`) |

## Invités (`vues_invites.py`)
| Méthode | Route | Droits | Détail |
|---|---|---|---|
| GET | `evenements/<id>/invites/` | A | `q, statut, mode, magazine, email1, tri, page, taille` → `{total, page, pages, taille, compteurs:{tous, inscrits, presents, aRenvoyer}, resultats}` |
| POST | `evenements/<id>/invites/` | A | ajout manuel (+ `envoyerInvitation`) |
| POST | `evenements/<id>/invites/actions-groupees/` | A (SUPPRIMER : S) | `{action: VALIDER/RENVOYER/EXPORTER/SUPPRIMER, ids (≤ 5 000), tous, format}` ; > 50 → 202 `{tacheId, nb}` ; RENVOYER : 5/h par compte (429), invités ayant reçu une invitation depuis moins d’1 h ignorés → `{traites, ignores}` |
| GET | `evenements/<id>/invites/export/` | A | `format=xlsx|csv` + filtres |
| GET | `invites/` | S | tous les invités (+ `evenement`, `programme`) |
| GET | `invites/export/` | S | export de tous les invités |
| GET, PATCH, DELETE | `invites/<id>/` | A (DELETE : S) | fiche, modification, suppression |
| GET | `invites/<id>/qr.png` | A | QR PNG |
| POST | `invites/<id>/renvoi-email/` | A | `{type: INVITATION|MAGAZINE|SONDAGE}` → 202 ; 409 `MAGAZINE_INDISPONIBLE` (invité non présent, ou magazine désactivé / sans lien : `suivi_emails.magazine_disponible`) ; 409 `SONDAGE_INDISPONIBLE` (sondage désactivé, lien expiré, ou dernier envoi n°3 pas en échec : `sondages.sondage_renvoyable`) ; si l’invité a déjà répondu, 202 **sans envoi** (réponse identique : l’admin n’apprend pas qui a répondu) |
| GET | `invites/<id>/historique/` | A | événements datés |
| POST | `invites/<id>/presence/` | A | valider (MANUEL) |
| POST | `invites/<id>/presence/annulation/` | S | annuler la présence (`{motif}` sans caractère de contrôle) |
| GET | `taches/<id>/`, `taches/<id>/fichier/` | propriétaire | état, téléchargement unique |

## Configuration (`vues_admin.py`)
| Méthode | Route | Droits | Détail |
|---|---|---|---|
| CRUD | `programmes/` | lecture A, écriture S | `nom` sans caractère de contrôle ; DELETE `?confirmation=<nom>` s’il a des cérémonies (cascade) |
| CRUD | `evenements/` | lecture A (liste : borne), écriture S | DELETE `?confirmation=<nom affiché>` s’il a des invités ; en borne, la liste utilise `EvenementBorneSerializer` (ni hôtes, ni lien d’inscription, ni réglages) |
| POST | `evenements/<id>/regenerer-slug/` | S | nouveau lien, l’ancien devient `AncienSlug` |
| GET | `evenements/<id>/qr-inscription.png` | S | QR du lien d’inscription (action hors de la liste « lecture » de `EvenementViewSet.get_permissions`) |
| GET | `evenements/<id>/statistiques/` | A | tableau de bord (cache 30 s) |
| GET | `evenements/<id>/rapport/` | A | PDF (30/h) |
| GET | `evenements/<id>/apercu-emails/` | A | HTML des trois emails (`TypeEmail.values`) avec données fictives ; utilisé par l’écran « Suivi des emails » (`SuiviEmails.jsx`) |
| GET | `evenements/<id>/sondage/` | A | résultats du sondage : état, envoyés, réponses, taux, moyennes, NPS, répartitions, 20 commentaires anonymes |
| GET | `evenements/<id>/suivi-emails/` | A | compteurs envoyés / en attente / en échec par email, 50 derniers échecs |
| POST | `evenements/<id>/suivi-emails/renvoyer-echecs/` | A | `{type}` : replanifie les envois dont le dernier est en échec (n°2 et n°3 : présents seulement ; n°3 : lien ouvert et sans réponse) → `{traites}` (10/h) ; 409 `MAGAZINE_INDISPONIBLE` / `SONDAGE_INDISPONIBLE` |
| POST | `evenements/<id>/suivi-emails/test/` | A | `{type}` : email de test **synchrone** (objet « [Test] ») vers le compte connecté → `{destinataire}` (10/h) ; 502 `ENVOI_IMPOSSIBLE` si SMTP échoue |
| CRUD | `admins/` | S | POST renvoie `motDePasseTemporaire` une fois ; PATCH `actif: false` incrémente `version_session` (sessions fermées, elles ne revivent pas à la réactivation) |
| POST | `admins/<id>/reinitialiser-mot-de-passe/` | S | nouveau mot de passe temporaire, sessions fermées |
| GET, PATCH | `parametres/` | S | modèles d’emails (`objetEmail1..3` sans caractère de contrôle), scan ; enregistrés réellement depuis le 2026-10-22 (correction de `JSON_UNDERSCOREIZE`, voir [configuration-super-admin](../features/configuration-super-admin.md)) |
| POST | `parametres/apercu-email/` | S | `{type, objet, corps, programme}` → `{objet, html, texte}` |
| GET | `journal/` | S | `auteur` (id ou `systeme`), `categorie`, `action`, `du`, `au`, `page` (50) |
| GET | `comptes/` | S | liste courte (filtre auteur) |
| GET | `exports/<invites|presences|emails|journal>/` | S | `format`, `evenement`, `programme` |
| GET | `analytique/`, `analytique/technique/`, `rapports/global/` | S | analyses, indicateurs, PDF |
| GET | `analytique/sondages/` | S | satisfaction : cumul et ligne par cérémonie |
| GET | `erreurs-techniques/` | S | `statut=a_traiter|resolues|toutes`, `source`, `page` (30) |
| PATCH | `erreurs-techniques/<id>/` | S | `{resolue}` |
| POST | `erreurs-techniques/actions/` | S | `{action: resoudre_tout|supprimer_resolues}` |

## WebSocket
`/api/ws/` : canal descendant uniquement ; messages `{type: "pret"}`, `{type: "maj", sujets, evenements}` ;
fermetures 4001 (session) et 4003 (compte). Voir [temps-reel](../features/temps-reel.md).
