---
type: architecture
statut: implémenté
verifie: 2026-10-13
commit: dc0c75a
sources: [backend/apps, frontend/src]
---

# Composants et fichiers

## Backend — `backend/apps/noyau/`

| Fichier | Contenu principal |
|---|---|
| `models.py` | Programme, Evenement, AncienSlug, Statut, Invite, Emargement, EmailEnvoye, JournalActivite, Parametres (singleton), ErreurTechnique — voir [data-model](data-model.md) |
| `statuts.py` | constantes `INSCRIT`, `PRESENT` (le code ne référence jamais les libellés) |
| `services.py` | `etat_inscriptions`, `statut_evenement`, `tirer_code`, `creer_invite`, `inscrire`, `emarger`, `annuler_emargement`, `annuler_presence`, `compteurs` |
| `serializers.py` | sérialiseurs, `tokens_programme`, `evenements_annotes`, `invites_annotes` (sous-requêtes email1/email2) |
| `validation.py` | nom, email, téléphone (+225, 10 chiffres), couleur, refus des caractères de contrôle, `entier`, `date_iso`, `donnees_objet` |
| `filtres.py` | recherche (nom, prénom, email, entreprise, code, téléphone), filtres, tri (`TRIS`), `PaginationInvites` (25/50/100) |
| `vues_public.py` | événement public, inscription, renvoi du QR, agenda .ics |
| `vues_scan.py` | émargement, annulation, derniers passages, réglages de scan |
| `vues_invites.py` | listes, détail/PATCH/DELETE, QR PNG, renvoi, historique, actions groupées, exports, suivi de tâche |
| `vues_admin.py` | viewsets Programme / Evenement / Admin, paramètres, aperçu email, journal, exports globaux, analyses, rapports |
| `vues_erreurs.py` | signalement navigateur (public), consultation et résolution (super admin) |
| `emails.py` | rendu (`rendre`), `construire_message` (CID + pièces jointes), `planifier`, `magazine_deja_parti` |
| `tasks.py` | `envoyer_email` (3 relances 30 s / 2 min / 8 min), `relancer_emails_en_attente` (beat 5 min), `purger` (beat 1 h) |
| `taches.py` | tâches d’export et d’action groupée > 50 invités, état en cache `tache:<id>`, fichiers à usage unique |
| `temps_reel.py` | signaux Django → `notifier` (regroupé, après commit) ; invalidation des caches |
| `consumers.py` | `TempsReelConsumer` (WebSocket `/api/ws/`) |
| `caches.py` | `lire`, `invalider` (deux fois : immédiat + au commit), clés `stats:<id>`, `public:<slug>`, `analytique` |
| `statistiques.py` | tableau de bord d’une cérémonie |
| `analytique.py` | analyses globales et indicateurs techniques (super admin) |
| `rapports.py` | PDF ReportLab : `rapport_evenement`, `rapport_global` |
| `exports.py` | lignes invités / présences / emails / journal, CSV (BOM, « ; ») et XLSX, neutralisation des formules |
| `journal.py`, `journal_texte.py` | `journaliser` (actions listées dans `CATEGORIES`), libellés reconstitués à l’affichage |
| `erreurs.py`, `mesures.py` | erreurs techniques groupées par signature ; métriques par minute dans Redis |
| `ics.py`, `qr.py`, `icones_email.py`, `theme.py`, `dates.py` | .ics, QR PNG, icônes PNG des emails, dérivation des couleurs, formats français |
| `middleware.py`, `logs.py`, `exceptions.py` | santé `/api/sante/`, CSP et en-têtes, masquage PII, gestionnaire d’erreurs (`ErreurMetier`) |
| `management/commands/seed_demo.py` | données de démonstration idempotentes |

## Backend — `backend/apps/comptes/`
| Fichier | Contenu |
|---|---|
| `models.py` | `Admin` (email unique, rôle, `actif`, `doit_changer_mot_de_passe`, `version_session`) |
| `authentication.py` | `CookieJWTAuthentication`, `emettre_jetons`, `jeton_revoque` |
| `permissions.py` | `CompteUtilisable` (défaut), `EstAdmin`, `EstSuperAdmin`, `evenements_visibles` |
| `throttles.py` | `CacheDeSecours`, `ConnexionThrottle`, `ConnexionCompteThrottle` |
| `views.py` | csrf, connexion, rafraîchir, déconnexion, moi, mot de passe |

## Frontend — `frontend/src/features/`
| Dossier | Écrans |
|---|---|
| `invite/` | `InscriptionPage` (présentation → formulaire → états), `Presentation`, `ConfirmationPage`, `PratiquePage`, `pratique.jsx`, `EtatCarte`, `LienInvalide`, `commun.jsx` |
| `scan/` | `ScanSetup` (S1), `ScanPoste` (S2–S12 selon l’appareil), `composants.jsx`, `useCamera` (ZXing), `fileHorsLigne` (IndexedDB), `reglages`, `retour` (son, vibration), `useWakeLock`, `useEvenementsScan` |
| `admin/` | `ChoixCeremonie` (A2), `EspaceEvenement` (mise en page), `TableauDeBord` (A3), `ApercuEmails` (A7) |
| `invites/` | `GestionInvites` (A4 et SA9), `PanneauInvite` (A5), `PanneauAjout` (A6), `badges` |
| `super/` | `SuperApp`, `VueGlobale`, `Analyses`, `Programmes`, `Evenements`, `TousInvites`, `Comptes`, `Parametres`, `Journal`, `Erreurs` |
| `auth/` | `ConnexionAdmin`, `ConnexionSuper`, `FormulaireConnexion`, `ChangerMotDePasse`, `RequireRole`, `useMoi`, `Introuvable` |

## Partagé
- `shared/token-fixtures.json` : cas de référence de la dérivation des couleurs, testés en JS et en Python.
