---
type: architecture
statut: implémenté
verifie: 2026-10-13
commit: dc0c75a
sources: [backend/apps/noyau/models.py, backend/apps/comptes/models.py, backend/apps/noyau/migrations/, backend/apps/noyau/statuts.py]
---

# Modèle de données

Base MySQL 8 utf8mb4 (Postgres sur l’environnement Vercel), stockage en UTC, fuseau d’affichage `Africa/Abidjan` (UTC+0).
Migrations : `0001_initial` → `0007_anciens_slugs` (noyau), `0001_initial` (comptes).

## Entités

### Programme
`nom` (unique), `couleur_principale`, `couleur_secondaire` (#RRGGBB, mises en majuscules), `actif`,
`magazine_actif`, `lien_magazine`, dates. Créés par la data migration `0002` : AMP `#8F1C1F/#F7941D`,
PMD `#1A5E36/#FFF200`, Public-AMP `#77421C/#F7941D`, Public-ASD `#06474F/#F37740`.

### Evenement (cérémonie)
`programme` (FK **PROTECT**), `date`, `heure_debut`, `heure_accueil`, `lieu`, `lien_carte`, `capacite` (≥ 1),
`date_limite_inscription`, `inscriptions_ouvertes`, `slug_inscription` (unique), `admins` (M2M Admin).
- `nom_affiche` = « Graduation {programme} {année} » — **calculé, jamais stocké**.
- Slug : `slugify(programme)-année-<6 hex>`, jamais réattribué (vérifie aussi `AncienSlug`).
- Validations : date limite ≤ date ; accueil ≤ début.

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
- Index : (evenement, statut), (evenement, present_le), (evenement, nom), (evenement, inscrit_le).

### Emargement
`invite`, `admin` (SET_NULL → « Compte supprimé »), `mode`, `poste`, `appareil` (TELEPHONE | TABLETTE | ORDINATEUR),
`date`, `date_client`, `annule_le`, `annule_par`, `motif_annulation`. Une annulation ne supprime jamais la ligne.

### EmailEnvoye
`invite`, `type` (INVITATION | MAGAZINE), `statut` (EN_ATTENTE | ENVOYE | ECHEC), `tentatives`, `envoye_le`,
`erreur`, `cree_le`. Une ligne par envoi (chaque renvoi crée une ligne). La colonne « Email 1 » affiche le
statut de la **dernière** ligne INVITATION.

### JournalActivite
`auteur` (NULL = « Système »), `action` (codes de `journal.CATEGORIES`), `cible_type`, `cible_id`, `details`
(JSON **sans donnée personnelle**), `date`.

### Parametres (singleton pk=1)
Objets et corps des emails n°1 et n°2 (texte avec variables), `duree_resultat_scan` (2 | 3 | 5 s, défaut 3),
`son_actif`, `vibration_actif`, `expediteur` (« Flex’Checking · MDE Business School »).

### ErreurTechnique
`source` (NAVIGATEUR | SERVEUR | TACHE | EMAIL), `signature` (sha256, unique), `type`, `message`, `lieu`,
`details`, `navigateur`, `occurrences`, `premiere`, `derniere`, `resolue`, `resolue_le`.

### Admin (`apps/comptes`)
`nom`, `email` (unique, minuscules), `role` (SUPER_ADMIN | ADMIN), `actif`, `derniere_connexion`,
`doit_changer_mot_de_passe`, `version_session`, mot de passe Argon2. `last_login` désactivé.

## Suppressions en cascade (super admin uniquement)
- Programme → ses cérémonies → leurs invités (confirmation par saisie du nom s’il a des cérémonies).
- Cérémonie → invités, emails, émargements (confirmation par saisie du nom s’il y a des invités).
- Admin : ses émargements restent (admin à NULL) ; dernier super admin et son propre compte protégés.
