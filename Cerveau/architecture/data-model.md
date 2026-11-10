---
type: architecture
statut: implémenté
verifie: 2026-11-10
commit: 93646d7
sources: [backend/apps/noyau/models.py, backend/apps/comptes/models.py, backend/apps/noyau/migrations/, backend/apps/noyau/statuts.py, backend/apps/noyau/sondages.py, backend/apps/noyau/donnees_personnelles.py, backend/apps/comptes/migrations/]
---

# Modèle de données

Base MySQL 8 utf8mb4 (Postgres sur l’environnement Vercel), stockage en UTC, fuseau d’affichage `Africa/Abidjan` (UTC+0).
Migrations : `0001_initial` → `0015_email_2_toujours_envoye` (noyau ; la 0008 supprime les invités inscrits dans le futur, sans changer le schéma, et affiche leur nombre ; la 0009 ajoute `sondage_actif`, les champs de l’email n°3, le type `SONDAGE` et les deux tables du sondage ; la 0010 les champs des données personnelles ; la 0011 `EmailEnvoye.derniere_tentative_le` ; la 0012 les liens de cérémonie (`lien_magazine`, `lien_brochure`, `lien_carte_invitation`), `Parametres.lien_brochure_defaut`, les nouveaux corps par défaut des emails n°1 et n°2 et l’alignement `date_limite_inscription = date` ; la 0013 la table `CarteInvitation` ; la 0014 l’objet par défaut de l’email n°1 ; la 0015 l’objet et le corps par défaut de l’email n°2 — les 0012, 0014 et 0015 ne remplacent un texte que s’il n’a pas été personnalisé), `0001_initial` et `0002_version_session` (comptes).

## Entités

### Programme
`nom` (unique), `couleur_principale`, `couleur_secondaire` (#RRGGBB, mises en majuscules), `actif`,
`magazine_actif` (sans effet depuis le 2026-11-10, champ gardé selon [ADR-014](../decisions/ADR-014-migrations-expand-contract.md)), `lien_magazine` (lien par défaut des cérémonies), `sondage_actif` (défaut vrai), dates. Créés par la data migration `0002` : AMP `#8F1C1F/#F7941D`,
PMD `#1A5E36/#FFF200`, Public-AMP `#77421C/#F7941D`, Public-ASD `#06474F/#F37740`.

### Evenement (cérémonie)
`programme` (FK **PROTECT**), `date`, `heure_debut`, `heure_accueil`, `lieu`, `lien_carte`, `capacite` (≥ 1),
`lien_magazine`, `lien_brochure`, `lien_carte_invitation` (URL, vides par défaut, migration `0012`),
`date_limite_inscription` (plus saisie depuis `0012` : alignée sur `date` par `save`), `inscriptions_ouvertes`, `slug_inscription` (unique), `admins` (M2M Admin),
`anonymise_le` (null ; date de la dernière anonymisation de ses invités, migration `0010`).
- `nom_affiche` = « Graduation {programme} {année} » — **calculé, jamais stocké** ; `nom_agenda` = « Cérémonie de
  Graduation {programme} {année} » ; `lien_magazine_effectif` (cérémonie, sinon programme) ;
  `magazine_disponible` (lien effectif : bouton « Lire le magazine » de l’email n°2 ; depuis le 2026-11-10, `magazine_actif` n’a plus d’effet).
- Slug : `slugify(programme)-année-<6 hex>`, jamais réattribué (vérifie aussi `AncienSlug`).
- Validations : accueil ≤ début (la règle « date limite ≤ date » a disparu avec la saisie de la date limite).

### CarteInvitation
`evenement` (OneToOne, CASCADE, `related_name="carte_invitation"`), `nom`, `type_mime` (`image/jpeg`, `image/png`,
`application/pdf`), `taille`, `contenu` (BinaryField, 1,8 Mo au plus), `modifie_le` ; migration `0013`. Table à
part : la liste des cérémonies ne charge que les métadonnées (`Prefetch … only(…)`). Voir
[ADR-016](../decisions/ADR-016-carte-invitation-en-base.md).

### AncienSlug
Lien remplacé par une régénération : reste lisible (page pratique, agenda, renvoi du QR) mais **n’accepte plus
d’inscription** et ne révèle jamais le nouveau lien.

### Statut
Table de référence `INSCRIT` (ordre 1), `PRESENT` (ordre 2), créée par data migration.

### Invite
`evenement` (CASCADE), `statut` (FK PROTECT, défaut INSCRIT), `civilite` (MME | M), `nom`, `prenom`, `email`,
`telephone` (stocké « +225 07 12 34 56 78 »), `entreprise`, `fonction`, `source` (FORMULAIRE | MANUEL),
`code` (4 chiffres), `qr_token` (unique, `token_urlsafe(24)`), `consentement_donnees`, `consentement_le`,
`inscrit_le`, `present_le`, `mode_emargement` (QR_CAMERA | DOUCHETTE | CODE | MANUEL).
- Contraintes : **unique (evenement, email)** et **unique (evenement, code)**.
- **Pas d’inscription dans le futur** : `Invite.save()` refuse `inscrit_le` ou `consentement_le` postérieurs à
  maintenant + 1 min (`ValidationError`). Le formulaire et l’ajout manuel les datent à l’heure du serveur. Garde-fou
  applicatif seulement (MySQL n’accepte pas `NOW()` dans un `CHECK`) ; `bulk_create` le contourne, d’où le test sur
  `seed_demo`.
- **Invité anonymisé** (`donnees_personnelles.anonymiser_evenement`) : nom « Anonyme », prénom, téléphone,
  entreprise, fonction et `consentement_le` vidés, email `anonyme-<id>@anonyme.invalid`, nouveau `qr_token` ;
  c’est ce domaine d’email qui distingue un invité anonymisé (pas `Evenement.anonymise_le`).
- Index : (evenement, statut), (evenement, present_le), (evenement, nom), (evenement, inscrit_le).

### Emargement
`invite`, `admin` (SET_NULL → « Compte supprimé »), `mode`, `poste`, `appareil` (TELEPHONE | TABLETTE | ORDINATEUR),
`date`, `date_client`, `annule_le`, `annule_par`, `motif_annulation`. Une annulation ne supprime jamais la ligne.

### EmailEnvoye
`invite`, `type` (INVITATION | MAGAZINE | SONDAGE), `statut` (EN_ATTENTE | ENVOYE | ECHEC), `tentatives`,
`derniere_tentative_le` (null, migration `0011` ; sert à la relance des tentatives perdues), `envoye_le`,
`erreur`, `cree_le`. Une ligne par envoi (chaque renvoi crée une ligne). La colonne « Email 1 » affiche le
statut de la **dernière** ligne INVITATION. Libellés communs : `libelle_email` / `LIBELLES_EMAIL` (« Email n°1 · invitation », « Email n°2 · magazine », « Email n°3 · sondage »).

### JournalActivite
`auteur` (NULL = « Système »), `action` (codes de `journal.CATEGORIES`), `cible_type`, `cible_id`, `details`
(JSON **sans donnée personnelle**), `date`.

### Parametres (singleton pk=1)
- `duree_conservation_mois` (1–60, défaut 12) et `contact_donnees` (email, facultatif) : protection des données personnelles (migration `0010`, colonnes avec `db_default`) ; voir [donnees-personnelles](../features/donnees-personnelles.md).
Objets et corps des emails n°1, n°2 et n°3 (`objet_email_3`, `corps_email_3` ; texte avec variables, dont `{lien_sondage}`), `duree_resultat_scan` (2 | 3 | 5 s, défaut 3),
`son_actif`, `vibration_actif`, `expediteur` (« Flex’Checking · MDE Business School »), `lien_brochure_defaut` (URL, défaut `https://mde.ci`, migration `0012` : bouton brochure de l’email n°2 quand la cérémonie n’a pas de `lien_brochure`).
Objets par défaut : n°1 « Votre inscription à la cérémonie de Graduation {programme} {annee} » (`0014`), n°2 « Bienvenue à la cérémonie de Graduation {programme} {annee} » (`0015`).

### InvitationSondage
`invite` (OneToOne, CASCADE, `related_name="sondage"`), `jeton` (unique, `token_urlsafe(24)`), `cree_le`, `expire_le`
(= création + 24 h, `DUREE_SONDAGE_HEURES`), `repondu` (booléen **sans horodatage**). Créée par
`sondages.planifier_sondages`, une seule par invité.

### ReponseSondage
**Anonyme** : rattachée à la cérémonie seulement, ni à l’invité ni au lien. `evenement` (CASCADE),
`note_globale` et `note_accueil` (1-5), `recommandation` (0-10), `commentaire` (≤ 1 000), `appareil` et
`appareil_local` (empreintes SHA-256 de « id cérémonie : identifiant »), `cree_le` (arrondi à l’heure par
`sondages.repondre`). Contrainte **unique (evenement, appareil)** (`sondage_un_par_appareil`) ; index
(evenement, appareil_local). La réponse unique par lien passe par `InvitationSondage.repondu`.

### ErreurTechnique
`source` (NAVIGATEUR | SERVEUR | TACHE | EMAIL), `signature` (sha256, unique), `type`, `message`, `lieu`,
`details`, `navigateur`, `occurrences`, `premiere`, `derniere`, `resolue`, `resolue_le`.

### Admin (`apps/comptes`)
`nom`, `email` (unique, minuscules), `role` (SUPER_ADMIN | ADMIN), `actif`, `derniere_connexion`,
`doit_changer_mot_de_passe`, `version_session`, mot de passe Argon2. `last_login` désactivé.

## Suppressions en cascade (super admin uniquement)
- Programme → ses cérémonies → leurs invités (confirmation par saisie du nom s’il a des cérémonies).
- Cérémonie → invités, emails, émargements, liens et réponses du sondage (confirmation par saisie du nom s’il y a des invités).
- Admin : ses émargements restent (admin à NULL) ; dernier super admin et son propre compte protégés.
