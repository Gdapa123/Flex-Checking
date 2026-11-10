---
type: architecture
statut: implémenté
verifie: 2026-11-10
commit: 93646d7
sources: [backend/apps, frontend/src, backend/Dockerfile]
---

# Composants et fichiers

## Backend — `backend/apps/noyau/`

| Fichier | Contenu principal |
|---|---|
| `models.py` | Programme, Evenement (`nom_agenda`, `lien_magazine_effectif`, `magazine_disponible`), CarteInvitation, AncienSlug, Statut, Invite, Emargement, EmailEnvoye, JournalActivite, Parametres (singleton), ErreurTechnique, InvitationSondage, ReponseSondage ; `libelle_email` (libellés uniques des trois emails) — voir [data-model](data-model.md) |
| `statuts.py` | constantes `INSCRIT`, `PRESENT` (le code ne référence jamais les libellés) |
| `services.py` | `etat_inscriptions`, `statut_evenement`, `tirer_code`, `creer_invite`, `inscrire`, `emarger`, `annuler_emargement`, `annuler_presence`, `compteurs` |
| `serializers.py` | sérialiseurs (dont `EvenementBorneSerializer`, liste réduite pour la borne ; `EmargementRequeteSerializer.choix_borne`), `tokens_programme`, `evenements_annotes`, `invites_annotes` (sous-requêtes email1/email2) |
| `validation.py` | nom, email, téléphone (+225, 10 chiffres), couleur, refus des caractères de contrôle, `entier`, `date_iso`, `donnees_objet`, `est_qr_token` (format d’un QR code d’invitation, miroir de `schemas.natureQr`) |
| `filtres.py` | recherche (nom, prénom, email, entreprise, code, téléphone), filtres, tri (`TRIS`), `PaginationInvites` (25/50/100) |
| `vues_public.py` | événement public (dont `magazineActif`, `brochureActive`), inscription, renvoi du QR, agenda .ics, carte d’invitation (`CarteInvitationView`), images des emails (`ImageEmailView`), politique de confidentialité (`ConfidentialiteView`, plus appelée par le frontend depuis 230cf6d) |
| `cartes_invitation.py` | carte d’invitation en fichier : `preparer` (type reconnu au contenu, images réencodées, 1,8 Mo au plus), `extension`, `lien_public`, `carte_pour_agenda` (fichier, sinon ancien `lien_carte_invitation`) — voir [ADR-016](../decisions/ADR-016-carte-invitation-en-base.md) |
| `donnees_personnelles.py` | conservation limitée : `evenements_expires` (cérémonies ayant encore des invités identifiables), `anonymiser_evenement`, `anonymiser_donnees_expirees` — voir [donnees-personnelles](../features/donnees-personnelles.md) |
| `vues_scan.py` | émargement, annulation (super admin), derniers passages, réglages de scan, recherche de la borne ; jeton signé « C’est moi » (`jeton_choix_borne`, `choix_borne_valide`) |
| `suivi_emails.py` | suivi des emails (A7) : invités à contacter (`a_contacter`, `cause_echec`), compteurs (n°2 toujours `actif`), échecs, renvoi groupé (`renvoyer_echecs`), email de test ; `magazine_disponible` retiré le 2026-11-10 |
| `adresses.py` | adresses probablement mal tapées : `suggerer_correction` (domaine à 1-2 fautes d’un fournisseur courant) |
| `alertes.py` | alertes email aux super admins (compte bloqué, nouvelle erreur serveur), plafonnées |
| `sondages.py` | sondage de satisfaction : `planifier_sondages` (8 h, idempotente ; sans file : envoi dans un budget de 200 s), `etat`, `resultats`, `resume_global`, NPS, `repondre` (réponse unique par lien et par appareil), `sondage_renvoyable` (indépendant de la réponse de l’invité) |
| `vues_sondage.py` | page publique du sondage, déclencheur du cron (`CRON_SECRET` : sondage puis anonymisation), cumul super admin |
| `vues_invites.py` | listes, détail/PATCH/DELETE, QR PNG, renvoi, historique, actions groupées, exports, suivi de tâche |
| `vues_admin.py` | viewsets Programme / Evenement / Admin (actions `statistiques`, `rapport`, `apercu_emails`, `sondage`, `suivi_emails`, `renvoyer_echecs`, `email_test`, `carte_invitation`), paramètres, aperçu email, journal, exports globaux, analyses, rapports |
| `vues_erreurs.py` | signalement navigateur (public), consultation et résolution (super admin) |
| `emails.py` | rendu des trois emails (`rendre`, gabarits `invitation`, `magazine`, `sondage` ; n°2 : boutons magazine et brochure selon les liens), `lien_sondage`, `url_image_publique` et `nom_logo` (logo et icônes par lien, [ADR-015](../decisions/ADR-015-images-email-par-lien.md)), `construire_message` (seul le QR en CID + pièces jointes, `Message-ID` stable propre à l’envoi et à l’environnement), `message_depuis_rendu` (email de test), `planifier`, `magazine_deja_parti` |
| `tasks.py` | `envoyer_email` (3 relances 30 s / 2 min / 8 min ; email n°3 non envoyé si lien clos ou présence annulée), `relancer_emails_en_attente` (beat 5 min ; reprend les envois sans tentative après 15 min et ceux dont la dernière tentative, `derniere_tentative_le`, date de plus d’1 h), `envoyer_sondages` (beat toutes les heures de 8 h à 20 h), `anonymiser_donnees` (beat 3 h 30), `purger` (beat 1 h) |
| `taches.py` | tâches d’export et d’action groupée > 50 invités, état en cache `tache:<id>`, fichiers à usage unique |
| `temps_reel.py` | signaux Django → `notifier` (regroupé, après commit) ; invalidation des caches |
| `consumers.py` | `TempsReelConsumer` (WebSocket `/api/ws/` ; messages `maj`, `perimetre`, `session_fermee`, `fermer`) |
| `caches.py` | `lire`, `invalider` (deux fois : immédiat + au commit), clés `stats:<id>`, `public:<slug>`, `analytique` |
| `statistiques.py` | tableau de bord d’une cérémonie |
| `analytique.py` | analyses globales et indicateurs techniques (super admin) |
| `rapports.py` | PDF ReportLab : `rapport_evenement`, `rapport_global` (avec section satisfaction, `_section_satisfaction`) |
| `exports.py` | lignes invités / présences / emails / journal, CSV (BOM, « ; ») et XLSX, neutralisation des formules |
| `journal.py`, `journal_texte.py` | `journaliser` (actions listées dans `CATEGORIES`), libellés reconstitués à l’affichage |
| `erreurs.py`, `mesures.py` | erreurs techniques groupées par signature ; métriques par minute dans Redis |
| `ics.py`, `qr.py`, `icones_email.py`, `theme.py`, `dates.py` | .ics (titre `nom_agenda`, deux rappels `VALARM`, carte en `ATTACH`), QR PNG, icônes PNG des emails, dérivation des couleurs, formats français |
| `middleware.py`, `logs.py`, `exceptions.py` | santé `/api/sante/` (avec `X-Frame-Options: DENY`), CSP et en-têtes, masquage PII et des jetons du sondage (`masquer_jetons`), chaîne de requête masquée dans les journaux d’accès (`MasquerParametresUrl` : Uvicorn en production, runserver de Daphne via le logger `django.channels.server`), gestionnaire d’erreurs (`ErreurMetier`) |
| `management/commands/seed_demo.py` | données de démonstration idempotentes |

## Backend — `backend/apps/comptes/`
| Fichier | Contenu |
|---|---|
| `models.py` | `Admin` (email unique, rôle, `actif`, `doit_changer_mot_de_passe`, `version_session`) |
| `authentication.py` | `CookieJWTAuthentication`, `emettre_jetons`, `est_borne`, `revoquer_acces`, `jeton_revoque`, `verifier_csrf` |
| `permissions.py` | `CompteUtilisable` (défaut), `EstAdmin`, `EstSuperAdmin`, `evenements_visibles` |
| `throttles.py` | `CacheDeSecours`, `ident_reseau` (IPv6 regroupée par /64), `AnonymeThrottle`, `LimiteSensible`, `ConnexionThrottle`, `ConnexionIpThrottle`, `cle_echecs_connexion` (20 échecs/h par compte), `MotDePasseCompteThrottle` (+ `Heure`), `LimiteIpPartagee` |
| `views.py` | csrf, connexion (poste connu : cookie signé `fc_poste`), rafraîchir (CSRF, verrou, course des onglets `_renouvele_par_un_autre_onglet`), déconnexion (`session_fermee`), moi, mot de passe, vérification du mot de passe, mode borne |

## Frontend — `frontend/src/features/`
| Dossier | Écrans |
|---|---|
| `invite/` | `InscriptionPage` (présentation → formulaire → états), `Presentation`, `ConfirmationPage`, `PratiquePage`, `pratique.jsx`, `EtatCarte`, `LienInvalide`, `commun.jsx`, `SondagePage` (sondage de satisfaction), `ConfidentialitePage` (`/confidentialite`, texte statique sans appel à l’API) ; guide « Comment ça se passe ? » de `Presentation` : étape magazine / brochure selon `magazineActif` et `brochureActive` |
| `scan/` | `ScanApp` (routes), `ScanSetup` (S1), `ScanPoste` (S2–S12 selon l’appareil), `composants.jsx`, `useCamera` (ZXing), `fileHorsLigne` (IndexedDB), `reglages`, `retour` (son, vibration), `useWakeLock`, `useEvenementsScan` |
| `admin/` | `AdminApp` (routes), `ChoixCeremonie` (A2), `EspaceEvenement` (mise en page), `TableauDeBord` (A3), `CarteSatisfaction` (A3), `SuiviEmails` (A7, onglet `emails` : compteurs, échecs, renvoi groupé, email de test, aperçu ; remplace l’ancien `ApercuEmails`, supprimé) |
| `invites/` | `GestionInvites` (A4 et SA9), `PanneauInvite` (A5), `PanneauAjout` (A6), `badges` |
| `super/` | `SuperApp`, `VueGlobale`, `Analyses` (dont satisfaction), `Programmes`, `Evenements` (liens magazine / brochure, carte d’invitation via `lib/carteInvitation.js` ; plus de date limite saisie), `TousInvites`, `Comptes`, `Parametres` (dont `lienBrochureDefaut`), `Journal`, `Erreurs`, `ErreurChargement`, `donnees.js` |
| `auth/` | `ConnexionAdmin`, `ConnexionSuper`, `FormulaireConnexion`, `ChangerMotDePasse`, `RequireRole`, `useMoi`, `Introuvable` |

## Frontend — `frontend/src/lib/` (ajouts récents)
- `carteInvitation.js` : préparation du fichier de carte avant envoi (miroir de `cartes_invitation.py` : `TAILLE_MAX`, `TYPES_ACCEPTES`, `COTE_MAX`).
- `nouvelleVersion.js` : `installerRechargementVersion` (appelé par `main.jsx`, rechargement unique sur `vite:preloadError`) et `pageDifferee` (remplace `React.lazy` dans `App.jsx`).

## Image Docker du backend — `backend/Dockerfile`
Plusieurs étapes (depuis `7e0e071`) : `construction` (compilateurs, `/opt/venv`, rien d’autre n’est livré) →
`base` (Python + `libmariadb3` seulement) → `dev` (outils de test, `runserver`) et `prod`. L’environnement Vercel a
son propre `backend/Dockerfile.vercel`.

## Partagé
- `shared/token-fixtures.json` : cas de référence de la dérivation des couleurs, testés en JS et en Python.
