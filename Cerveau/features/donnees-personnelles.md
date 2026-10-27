---
type: feature
statut: implémenté
verifie: 2026-10-27
commit: 2365b1f
sources: [backend/apps/noyau/donnees_personnelles.py, backend/apps/noyau/models.py, backend/apps/noyau/migrations/0010_donnees_personnelles.py, backend/apps/noyau/tasks.py, backend/config/settings.py, backend/apps/noyau/vues_public.py, backend/apps/noyau/vues_sondage.py, backend/apps/noyau/vues_admin.py, backend/apps/noyau/serializers.py, backend/apps/noyau/journal.py, backend/apps/noyau/journal_texte.py, backend/apps/noyau/emails.py, backend/templates/emails/base.html, frontend/src/features/invite/ConfidentialitePage.jsx, frontend/src/features/invite/InscriptionPage.jsx, frontend/src/features/super/Parametres.jsx, frontend/src/features/super/Journal.jsx, frontend/src/lib/schemas.js, backend/apps/noyau/tests/test_donnees_personnelles.py, frontend/tests/confidentialite.test.jsx]
---

# Protection des données personnelles

**Objectif métier** : traiter les données des invités dans le respect de la loi ivoirienne n° 2013-450 du
19 juin 2013 (et des principes du RGPD) : information claire, durée de conservation limitée, droits des personnes,
traçabilité. Voir [ADR-013](../decisions/ADR-013-conservation-limitee-anonymisation.md).
**Utilisateurs** : invités (information, droits), super admin (réglages), système (anonymisation planifiée).

## Parcours
1. À l'inscription, la case de consentement renvoie vers la **politique de confidentialité** (`/confidentialite`,
   nouvel onglet). Depuis `7e0e071`, la mention sous la case cite « la loi ivoirienne n° 2013-450 sur la protection
   des données personnelles » au lieu du RGPD.
2. Chaque email (n°1, n°2, n°3) se termine par un lien « Vos données personnelles » vers cette page.
3. Le super admin règle dans **Paramètres › Données personnelles** la durée de conservation (1 à 60 mois, 12 par
   défaut) et l'adresse de contact affichée sur la page.
4. Chaque nuit (Celery Beat, 3 h 30) — ou au cron quotidien de l'environnement Vercel — les cérémonies dont la date
   est plus ancienne que la durée de conservation sont **anonymisées**.

Contenu de la page `/confidentialite` (sections) : responsable du traitement, données collectées (les réponses au
sondage, notes et commentaire, sans lien avec l'identité), finalités, base légale (consentement ; retrait par écrit,
la direction des événements supprime alors l'inscription), destinataires (personnel MDE concerné **et prestataires
techniques** d'hébergement et d'envoi des emails, éventuellement hors de Côte d'Ivoire, transferts encadrés « conformément
à la loi »), durée de conservation (seuls des chiffres et les avis anonymes sont gardés), sécurité, droits.

## Règles fonctionnelles (serveur)
- ✅ `donnees_personnelles.evenements_expires` : `Evenement.date` antérieure à aujourd'hui moins
  `Parametres.duree_conservation_mois` (calcul `mois_avant`) **et** au moins un invité encore identifiable (email
  hors `@anonyme.invalid`) : un invité ajouté ou corrigé après une première passe est anonymisé à la suivante.
- ✅ `anonymiser_evenement` (transaction, verrou sur la cérémonie, idempotent) : nom « Anonyme », prénom, téléphone,
  entreprise, fonction et date du consentement vidés, email remplacé par `anonyme-<id>@anonyme.invalid` (domaine réservé, unicité
  conservée), nouveau `qr_token` (l'ancien QR ne désigne plus personne) ; messages d'erreur d'envoi et motifs d'annulation d'émargement vidés ;
  liens personnels du sondage supprimés (les avis, déjà anonymes, restent) ; `Evenement.anonymise_le` daté ;
  journal `DONNEES_ANONYMISATION` (catégorie « Données personnelles », sans auteur) ; caches et temps réel
  invalidés. Ne traite que les invités encore identifiables (`_non_anonymises`) : la passe ne fait rien (0) s'il n'y
en a plus. Conservés : civilité, code, statut, heures et modes d'émargement (bilans chiffrés).
- ✅ `anonymiser_donnees_expirees` ne compte que les cérémonies où au moins un invité a été anonymisé.
- ✅ `GET /api/public/confidentialite/` (public) : `{contact, dureeConservationMois}`.
- ✅ `PATCH /api/parametres/` (super admin) : `dureeConservationMois` 1–60, `contactDonnees` email ou vide ;
  changement de durée journalisé (`PARAMETRES`).

## Composants et fichiers
| Rôle | Fichier / symbole |
|---|---|
| Règles d'anonymisation | `backend/apps/noyau/donnees_personnelles.py` |
| Champs | `Parametres.duree_conservation_mois`, `Parametres.contact_donnees`, `Evenement.anonymise_le` (migration `0010`, `db_default`) |
| Planification | `tasks.anonymiser_donnees`, `CELERY_BEAT_SCHEDULE["anonymiser-donnees"]` ; `vues_sondage.CronSondagesView` (sans Beat) |
| Page publique | `frontend/src/features/invite/ConfidentialitePage.jsx`, route `/confidentialite` |
| Réglages | `frontend/src/features/super/Parametres.jsx` (section « Données personnelles »), `schemaDonneesPersonnelles` |
| Emails | `emails.rendre` (`lien_confidentialite`), `templates/emails/base.html` et `*.txt` |

## Validation et autorisations
- Bornes identiques côté serveur (`ParametresSerializer`, `min_value`/`max_value`, `EmailField`) et navigateur (Zod).
- Réglages réservés au super admin (`ParametresView`, `EstSuperAdmin`) ; page publique en lecture seule.

## Scénarios d'erreur
| Cas | Comportement |
|---|---|
| Deux passes simultanées | verrou `select_for_update` sur la cérémonie ; la seconde ne trouve plus d'invité identifiable et ne fait rien |
| Invité ajouté ou corrigé après l'anonymisation | la cérémonie redevient « expirée » ; l'invité est anonymisé à la passe suivante (`anonymise_le` redaté) |
| Durée hors bornes / contact invalide | 400 (et message sous le champ dans l'interface) |
| Contact non renseigné | la page invite à contacter la direction des événements |

## Tests
- `backend/apps/noyau/tests/test_donnees_personnelles.py` (8 tests : calcul des mois, anonymisation et idempotence,
  durée réglable, page publique, droits, lien dans les emails, cron sans file,
  `test_invite_ajoute_apres_anonymisation_et_motifs_effaces`).
- `frontend/tests/confidentialite.test.jsx` (page et schéma) ; audit axe de `/confidentialite`
  (`frontend/e2e/accessibilite.spec.js`).

## Limites et décisions liées
- Raccourcir la durée de conservation demande une confirmation (`Dialogue` « Raccourcir la durée de conservation ? »
  indiquant la date avant laquelle les invités seront anonymisés, calculée par `moisAvant`, miroir de
  `donnees_personnelles.mois_avant` ; `Parametres.jsx`). Contrôle côté interface seulement : l'API accepte la
  nouvelle durée sans confirmation (changement journalisé).
- Anonymisation **irréversible** ; la suppression d'un invité à sa demande reste manuelle (super admin, fiche invité).
- Les sauvegardes antérieures contiennent encore les données : leur durée de conservation et leur chiffrement sont
  traités dans [deploiement-infomaniak](../operations/deploiement-infomaniak.md).
- Formalités auprès de l'ARTCI (déclaration ou autorisation) : ❓ à vérifier par MDE.
- Le texte du consentement cite la loi ivoirienne depuis `7e0e071`, mais ne mentionne toujours ni l'email n°2 ni le
  sondage (R8, ouvert).
- Filtre du journal : catégorie « Données personnelles » (`frontend/src/features/super/Journal.jsx`).
