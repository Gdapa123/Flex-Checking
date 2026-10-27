---
type: feature
statut: implémenté
verifie: 2026-10-26
commit: 2523cbb
sources: [backend/config/settings.py, backend/apps/noyau/tests/test_durcissement.py, frontend/src/features/super/SuperApp.jsx, frontend/src/features/super/VueGlobale.jsx, frontend/src/features/super/Analyses.jsx, frontend/src/features/super/Programmes.jsx, frontend/src/features/super/Evenements.jsx, frontend/src/features/super/Comptes.jsx, frontend/src/features/super/Parametres.jsx, frontend/src/features/super/Journal.jsx, backend/apps/noyau/journal.py, backend/apps/noyau/vues_admin.py, backend/apps/noyau/vues_sondage.py, backend/apps/noyau/serializers.py, backend/apps/noyau/urls.py]
---

# Espace super admin (configuration globale)

Univers MDE fixe. Navigation (`SuperApp.jsx`) : Vue globale, Analyses, Programmes, Cérémonies, Invités, Comptes
admins, Paramètres, Exports et journal, Erreurs (pastille du nombre à traiter) ; liens vers les espaces Admin et Scan.
Lien d’évitement « aller au contenu » (`LienEvitement`, cible `main#contenu` de `PageSuper`).

| Écran | Route | Contenu |
|---|---|---|
| SA2 Vue globale | `/super` | cérémonies à venir, inscrits cumulés, présents du jour, comptes (« Aucun / N mot(s) de passe temporaire(s) ») ; tableau de toutes les cérémonies, actions en boutons icônes (tableau de bord, configurer) |
| Analyses | `/super/analyses` | onglets **Activité** (par programme, année, mode, entreprise, inscriptions/jour ; taux de présence sur les cérémonies terminées seulement), **Satisfaction** (`GET /api/analytique/sondages/`, super admin : réponses, taux de réponse, note globale et accueil, NPS, tableau par cérémonie avec état du sondage — [sondage-satisfaction](sondage-satisfaction.md)) et **Technique** (trafic, erreurs, santé, emails 24 h) ; rapport PDF global — [exports-rapports](exports-rapports.md) |
| SA3/SA4 Programmes | `/super/programmes/:id?` | nom, couleurs (sélecteur + hexa), tokens dérivés, **contrôles de contraste WCAG**, aperçu en direct (formulaire, cadre de visée, email), lien magazine + activation email n°2, **activation email n°3 / sondage** (`sondageActif`, vrai par défaut), désactivation, suppression |
| SA5 Cérémonies | `/super/evenements/:id?` (`nouveau`) | programme actif, dates et heures, capacité, lieu, lien carte, inscriptions ouvertes, admins affectés, lien et QR d’inscription (PNG), **régénération du lien**, suppression ; garde « Quitter sans enregistrer ? » |
| SA9 Invités | `/super/invites` | [gestion-invites](gestion-invites.md) en univers MDE |
| SA6 Comptes | `/super/admins` | création (mot de passe temporaire affiché une fois — [ADR-003](../decisions/ADR-003-comptes-mot-de-passe-temporaire.md)), modification, réinitialisation, désactivation, suppression, matrice d’affectation aux cérémonies à venir ; actions de ligne en boutons icônes avec libellé accessible et info-bulle |
| SA7 Paramètres | `/super/parametres` | modèles des emails n°1, n°2 et **n°3 · sondage** (onglets ; variables insérables dont `{lien_sondage}` ; aperçu HTML serveur `POST /api/parametres/apercu-email/` différé 400 ms, une réponse périmée n’écrase pas une saisie plus récente), durée d’affichage du scan, son, vibration ; section **Données personnelles** (2026-10-22) : durée de conservation `dureeConservationMois` (1–60 mois, défaut 12) et contact `contactDonnees` (email), validés par `schemaDonneesPersonnelles` (Zod) et `ParametresSerializer`, lien vers `/confidentialite` ; **raccourcir** la durée ouvre un dialogue de confirmation qui annonce la date limite (`moisAvant`, miroir de `donnees_personnelles.mois_avant`) et l’anonymisation définitive dès la nuit suivante — voir [donnees-personnelles](donnees-personnelles.md) ; enregistrement journalisé `PARAMETRES` (durée comprise, pas le contact) |
| SA8 Exports et journal | `/super/journal` | 4 exports (invités, présences, emails, journal) en CSV/Excel avec périmètre programme/cérémonie ; journal filtrable par catégorie (Émargement, Invité, Email, Configuration, Export, Compte, **Données personnelles** — `DONNEES_ANONYMISATION`, ajoutée au filtre le 2026-10-22), auteur (dont « Système »), période ; 50 par page ; l’export « Suivi des emails » couvre les emails n°1 à n°3 |
| Erreurs | `/super/erreurs` | [erreurs-techniques](erreurs-techniques.md) |

## Garde-fous serveur
- ✅ **Modèles d'emails enregistrés** (bug corrigé le 2026-10-22) : jusque-là, les objets et corps modifiés dans SA7
  étaient ignorés en silence (« objetEmail1 » converti en « objet_email1 », champ inconnu) ; correction de
  `JSON_UNDERSCOREIZE` dans `backend/config/settings.py`, voir [emails](emails.md). Test
  `test_durcissement.py::test_modeles_d_email_enregistres`.
- Caractères de contrôle refusés : nom du programme (`ProgrammeSerializer.validate_nom`) et objets des emails n°1 à
  n°3 (`ParametresSerializer`).
- Désactivation d'un compte admin : `version_session` incrémentée (`AdminViewSet.perform_update`) ; ses sessions
  ouvertes sont fermées et ne revivent pas à la réactivation ([authentification](authentification.md)).
- Pas de verrou optimiste : deux super admins qui modifient le même programme, la même cérémonie ou les
  paramètres → le dernier enregistrement l'emporte sans avertissement (R20 de
  [risques-et-dette](../project/risques-et-dette.md)).
- Programme désactivé : impossible de l’affecter à une **nouvelle** cérémonie ou de changer vers lui.
- Magazine activé sans lien → 400.
- Son propre compte : ni désactivation, ni changement de rôle, ni suppression. Dernier super admin protégé.
- Suppressions en cascade : nom à retaper (`?confirmation=`) si l’objet contient des données.
- Lecture des programmes et cérémonies ouverte aux admins (listes), écriture réservée au super admin.

## Tests
`test_super_admin.py`, `test_suppressions.py`, `test_analytique.py`, `test_sondage.py`, `test_durcissement.py`
(modèles d'emails, désactivation, caractères de contrôle) (backend) ;
`frontend/tests/analyses.test.jsx`.
