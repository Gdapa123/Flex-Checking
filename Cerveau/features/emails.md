---
type: feature
statut: implémenté
verifie: 2026-11-10
commit: 93646d7
sources: [backend/apps/noyau/tests/test_corrections_invitation.py, backend/apps/noyau/vues_public.py, backend/templates/emails/invitation.html, backend/templates/emails/magazine.html, backend/apps/noyau/adresses.py, backend/apps/noyau/tests/test_a_contacter.py, backend/apps/noyau/tests/test_durcissement.py, backend/apps/noyau/emails.py, backend/apps/noyau/tasks.py, backend/apps/noyau/models.py, backend/apps/noyau/migrations/0011_derniere_tentative.py, backend/apps/noyau/migrations/0014_objet_email_1.py, backend/apps/noyau/migrations/0015_email_2_toujours_envoye.py, backend/apps/noyau/cartes_invitation.py, backend/apps/noyau/tests/test_suivi_emails.py, backend/apps/noyau/tests/test_invites.py, backend/apps/noyau/tests/test_emargement.py, backend/templates/emails/, backend/apps/noyau/icones_email.py, backend/apps/noyau/ics.py, backend/apps/noyau/qr.py, backend/apps/noyau/suivi_emails.py, backend/apps/noyau/vues_admin.py, backend/apps/noyau/vues_invites.py, backend/apps/noyau/sondages.py, backend/apps/noyau/services.py, backend/config/settings.py, frontend/src/features/admin/SuiviEmails.jsx, frontend/src/features/super/Parametres.jsx]
---

# Emails n°1 (invitation), n°2 (magazine) et n°3 (sondage)

## Quand
| Email | Déclencheur | Condition |
|---|---|---|
| n°1 · invitation | inscription publique, ajout manuel (case cochée par défaut), renvoi (public, fiche, action groupée) | toujours |
| n°2 · magazine | premier passage à Présent | **toujours** (depuis le 2026-11-10, migration `0015`), une seule fois : aucun email MAGAZINE déjà créé pour cet invité. Bouton « Lire le magazine » seulement si un lien existe (cérémonie, sinon programme : `Evenement.magazine_disponible`), bouton brochure seulement si un lien existe (cérémonie, sinon `Parametres.lien_brochure_defaut`) ; sans aucun lien, la carte disparaît. `Programme.magazine_actif` n’a plus d’effet (champ gardé, ADR-014) |
| n°3 · sondage | lendemain de la cérémonie, à partir de 8 h (Beat ou cron) | invité Présent, programme `sondage_actif`, aucun lien de sondage existant ; au moment de l’envoi, `tasks._envoyer` le passe en ECHEC sans l’envoyer si le lien est clos (24 h) ou si la présence a été annulée — voir [sondage-satisfaction](sondage-satisfaction.md) |

L’email n°2 **ne repart jamais automatiquement**, même après annulation puis nouveau scan
([ADR-004](../decisions/ADR-004-email-2-une-seule-fois.md)). Renvoi manuel possible depuis la fiche (invité Présent).

Renvoi manuel depuis la fiche (`POST /api/invites/<id>/renvoi-email/`, `vues_invites.RenvoiEmailView`, 5/h par
admin et par invité) : n°2 refusé (`MAGAZINE_INDISPONIBLE`) seulement si l’invité n’est pas Présent (depuis le 2026-11-10 ; avant, aussi
si le magazine était désactivé ou sans lien) ;
n°3 refusé (`SONDAGE_INDISPONIBLE`) si le programme a désactivé le sondage ou si le lien n’est plus renvoyable
(`sondages.sondage_renvoyable` : lien encore ouvert **et dernier envoi n°3 en ÉCHEC**, indépendamment de la
réponse). Depuis le 2026-10-22 (`7e0e071`), l’envoi a lieu **que l’invité ait répondu ou non** (réponse, journal
et statut d’email identiques ; `sondage_repondu` supprimé) : l’admin n’apprend pas qui a répondu ; au pire, un invité
qui a déjà répondu reçoit de nouveau son lien, qui affiche « déjà répondu ». Le renvoi du n°3 réutilise le même lien.

## Envoi (`emails.planifier` → `tasks.envoyer_email`)
1. Ligne `EmailEnvoye` (EN_ATTENTE) créée dans la transaction.
2. Mise en file Celery **après commit** ; si la file est injoignable, l’action de l’utilisateur réussit quand
   même et l’erreur est enregistrée.
3. Verrou de cache `email-envoi:<id>` (pas de double envoi concurrent).
4. Échec → 3 nouvelles tentatives à 30 s, 2 min, 8 min, puis ECHEC (« À renvoyer ») + erreur technique.
5. Celery beat toutes les 5 min (`tasks.relancer_emails_en_attente`, ≤ 500) : relance des emails EN_ATTENTE sans
   tentative créés depuis plus de 15 min, et de ceux qui ont déjà au moins une tentative et dont la **dernière
   tentative** (`EmailEnvoye.derniere_tentative_le`, migration `0011`, datée à chaque essai par `tasks._envoyer`) date
   de plus d’1 h — à défaut de cette date (envois antérieurs à la migration), créés depuis plus d’1 h. Le nouvel essai
   programmé a alors été perdu (file Redis vidée ou redémarrée) ; un email en plein cycle de tentatives n’est pas touché.
6. Sans Redis (Vercel) : envoi dans la requête, une seule tentative.
7. **`Message-ID` stable** (`emails.construire_message`) :
   `<flex-checking-<pk>.<horodatage de cree_le>.<hôte de APP_PUBLIC_URL>@<domaine de DEFAULT_FROM_EMAIL>>` ; si une
   relance renvoie le même email (livraison « au moins une fois »), la messagerie du destinataire le reconnaît comme
   doublon ; l’hôte et la date évitent qu’une base de test et la production produisent le même identifiant.

## Contenu (`emails.rendre`)
- Modèles éditables par le super admin (objet + corps texte, `Parametres.objet_email_1..3` / `corps_email_1..3`,
  écran Paramètres, un onglet par email). Objet par défaut de l’email n°1 (2026-11-10, migration `0014_objet_email_1`) :
  « Votre inscription à la cérémonie de Graduation {programme} {annee} ». Variables : `{civilite} {prenom} {nom} {programme} {annee} {date}
  {lieu} {qr_code} {code} {lien_magazine} {lien_sondage}`. Remplacement en **une seule passe** (`emails._remplacer`,
  expression régulière, 2026-10-22) : une valeur saisie par un invité (« {code} » comme prénom) n’est jamais
  remplacée à son tour. Objets des trois emails : caractères de contrôle refusés (`ParametresSerializer`,
  `sans_controle` : un saut de ligne rendrait l’en-tête invalide).
- ✅ **Bug corrigé le 2026-10-22** : les modèles modifiés par le super admin n’étaient **jamais enregistrés**
  depuis le premier commit. Le parseur camelCase (`JSON_UNDERSCOREIZE.no_underscore_before_number: True`) changeait
  « objetEmail1 » en « objet_email1 », champ inconnu ignoré en silence ; réglage passé à `False` dans
  `backend/config/settings.py` (« objet_email_1 »). Test `test_durcissement.py::test_modeles_d_email_enregistres`.
- Le texte avant le marqueur du type (`{qr_code}` n°1, `{lien_magazine}` n°2, `{lien_sondage}` n°3) va dans la
  carte message, le marqueur devient la carte centrale (QR + code de secours, carte magazine, ou carte « Votre
  avis en 3 questions » avec bouton et date de clôture), le texte après va dans une carte suivante ; infos
  pratiques et boutons Agenda / Itinéraire toujours ajoutés (n°1). Valeurs échappées en HTML.
- Gabarits `templates/emails/` : tables 600 px, compatibles Gmail/Outlook, pas de marge négative ; icônes en PNG
  générées par Pillow (`icones_email.py`) ; logo blanc ou rouge selon le contraste. Depuis le 2026-11-09, logo et
  icônes sont **servis par lien** (`emails.url_image_publique` → `GET /api/public/emails/images/<nom>.png`,
  `vues_public.ImageEmailView`, noms fermés, cache un an) au lieu d’être intégrés : certaines messageries listaient
  chaque image intégrée comme pièce jointe. Limite : une messagerie qui bloque les images distantes (Outlook de
  bureau) affiche le texte de remplacement du logo ; le QR code, lui, reste intégré.
- Structure MIME : `mixed[ related[ alternative(texte, html), QR code CID sans nom de fichier ], pièces jointes ]`.
- Pièces jointes n°1 : **seulement** `qr-code.png` et `graduation.ics` (aucune pièce jointe pour n°2 et n°3).
- Email n°1 en **billet d’entrée** (2026-11-09, refait à la demande : « pas très intéressant », « justifie et
  centre ») : tout centré, en-tête compris (`entete_centre`, l’en-tête des n°2 et n°3 reste aligné à gauche) ;
  salutation centrée, message justifié ; carte « BILLET D’ENTRÉE · {PROGRAMME} {année} » (bandeau `primary_soft`),
  QR code 140 px encadré de la couleur du programme, code de secours en pastille, pointillés, date / heure / lieu
  centrés, boutons « Agenda » / « Itinéraire » ; mise en garde courte sous la carte ; formule de fin (texte après
  `{qr_code}`, par défaut « À très bientôt ! », sans signature) **en bas**, couleur du programme. Mesuré à 390 px
  de large : formule de fin à 746 px.
- Email n°2 (2026-11-09) : deux boutons, « Lire le magazine » (`Evenement.lien_magazine_effectif`) et « Brochure
  Executive Education » (`Evenement.lien_brochure`, sinon `Parametres.lien_brochure_defaut`, `https://mde.ci` par
  défaut) ; un bouton sans lien est masqué. Depuis le 2026-11-10 (`ebcfcf7`, gabarit `magazine.html`) : sans lien
  de magazine, la carte s’intitule « Executive Education » (brochure seule) ; sans aucun lien, la carte disparaît ;
  le pré-en-tête ne mentionne le magazine que si son lien existe. Objet et corps par défaut changés (migration
  `0015_email_2_toujours_envoye`, anciens textes remplacés seulement s’ils n’avaient pas été personnalisés) :
  objet « Bienvenue à la cérémonie de Graduation {programme} {annee} », corps sans mention du magazine ni « ce soir ».
- Fichier .ics (`ics.ics_evenement`) : titre « Cérémonie de Graduation {programme} {année} »
  (`Evenement.nom_agenda`, aussi pour les liens Google Agenda / Microsoft 365 via `agenda.titre`), **deux rappels**
  (la veille `-P1D` et une heure avant `-PT1H`), carte d’invitation en `ATTACH;FMTTYPE=…` et dans la description
  (`cartes_invitation.carte_pour_agenda` : fichier téléversé, sinon ancien lien `Evenement.lien_carte_invitation`).
  Depuis le 2026-11-09 au soir, la carte est un **fichier** (« c’est un fichier, pas un lien ») : voir
  [configuration-super-admin](configuration-super-admin.md) et [ADR-016](../decisions/ADR-016-carte-invitation-en-base.md). Limite : le lien Google Agenda ne permet ni rappel ni pièce jointe (Google applique les
  rappels par défaut de l’utilisateur) ; seul le lien de la carte figure dans sa description.
- Gabarits par type : `invitation`, `magazine`, `sondage` (`.html` + `.txt`, sur `base.html`). Le gabarit `sondage.html` contient le questionnaire (formulaire HTML, voir [sondage-satisfaction](sondage-satisfaction.md)).
- Pied de page commun (`base.html` et les trois `.txt`) : adresse de MDE, mention propre au type, phrase « Cet email
  est envoyé automatiquement, merci de ne pas y répondre. » (ajoutée le 2026-11-06 : envoi prévu depuis
  `noreply@mde.ci`, Google Workspace, à confirmer en production), lien « Vos données personnelles ».
- Email n°1 : mise en garde sous le code de secours (HTML) et bloc « SÉCURITÉ » (texte) contre les faux emails à
  QR code piégé : QR code réservé à l’accueil, ni paiement ni mot de passe demandés, seul site officiel
  `site_officiel` (hôte de `APP_PUBLIC_URL`) — 2026-11-09, voir [sécurité de l’accueil](../operations/securite-accueil.md).
- Boutons de l’email → page publique `/i/<lien>/pratique#agenda` ou `#itineraire`.
- Expéditeur : `Parametres.expediteur` (défaut « Flex’Checking · MDE Business School ») `<DEFAULT_FROM_EMAIL>`
  (`DEFAULT_FROM_EMAIL` doit donc être une adresse seule) ;
  construction commune `emails.message_depuis_rendu` (envoi réel et email de test).
- Aperçu : HTML réel avec images en data URI (`apercu=True`), rempli avec un invité d’exemple
  (`vues_admin._source_exemple`, lien de sondage factice) : `POST /api/parametres/apercu-email/` (super admin) et
  `GET /api/evenements/<id>/apercu-emails/` (les trois types, utilisé par l’aperçu replié de A7).
- Écran A7 « Suivi des emails » (`frontend/src/features/admin/SuiviEmails.jsx`, logique serveur
  `backend/apps/noyau/suivi_emails.py`) — remplace l’ancien `ApercuEmails.jsx`, supprimé dans `bd4f807`. En tête
  (2026-11-09), « Invités à contacter » (`suivi_emails.a_contacter`, clé `aContacter`) : invitation jamais envoyée,
  dernier envoi en échec avec sa cause lue dans l’erreur SMTP (`suivi_emails.cause_echec`, côté adresse ou côté
  envoi), envoi en attente depuis plus de 15 min, adresse probablement mal tapée (`adresses.suggerer_correction`,
  distance d’édition sur les fournisseurs courants) ; actions « Corriger et renvoyer » (renvoie l’email en échec,
  sinon l’invitation), « Corriger l’adresse » (fiche), « Renvoyer », lien `tel:`. Puis une carte par email (n°1, n°2,
  n°3) avec compteurs envoyés / en attente / échecs (dernier envoi de chaque invité) et renvoi groupé ; aperçu et
  email de test vers son propre compte repliés ; voir
  [tableau-de-bord](tableau-de-bord.md) § A7. Points d’accès (admin de la cérémonie) :
  `GET evenements/<id>/suivi-emails/`, `POST …/suivi-emails/renvoyer-echecs/` (10/h, `relance_emails`),
  `POST …/suivi-emails/test/` (10/h, `email_test`).
- Renvoi groupé : seuls les invités dont le **dernier** envoi du type est en échec ; n°2 et n°3 : seulement les
  invités encore présents ; n°3 : seulement si le lien est encore ouvert (24 h), **que l’invité ait répondu ou non**
(anonymat, `suivi_emails.renvoyer_echecs`) ; refus
  `SONDAGE_INDISPONIBLE` si le sondage est désactivé pour le programme (le n°2 n’est plus jamais refusé depuis le
  2026-11-10 : `suivi_emails.magazine_disponible` supprimé, bloc `MAGAZINE.actif` toujours vrai) ; journal
  `EMAIL_RENVOI`. Email de test : objet préfixé « [Test] », envoi SMTP synchrone (`message.send()`), 502
  `ENVOI_IMPOSSIBLE` si le serveur SMTP échoue ; journal `EMAIL_TEST` (catégorie Email).

## Tests
`test_emails.py` (échec après 3 relances, échappement, lien en clair, boutons vers infos pratiques, mention
« ne pas répondre » dans les trois emails),
`test_emargement.py` (magazine unique, `test_email_2_envoye_meme_sans_magazine`), `test_analytique.py` (file indisponible, relance),
`test_suivi_emails.py` (compteurs, droits, renvoi groupé, `test_magazine_toujours_disponible_meme_sans_lien`,
email de test, SMTP indisponible), `test_corrections_invitation.py` (agenda, pièces jointes, formule de fin,
boutons du n°2, n°2 sans lien ou brochure seule, textes par défaut du n°2, images, liens refusés), `test_a_contacter.py` (46 cas collectés le 2026-11-10, paramétrages compris : causes SMTP, adresses douteuses, invités à contacter, nombre de requêtes), `test_sondage.py` (envoi, renvoi et aperçu du n°3), `test_invites.py`
(`test_renvoi_magazine_possible_sans_lien_mais_pas_avant_la_presence`), `test_durcissement.py` (`test_modeles_d_email_enregistres`,
`test_variables_remplacees_en_une_seule_passe`, `test_message_id_stable_par_envoi`,
`test_relance_d_une_tentative_perdue`, `test_renvoi_du_sondage_ne_revele_pas_qui_a_repondu`) ;
`frontend/tests/suiviEmails.test.jsx`.

## Limites
- L’ancien écart du renvoi manuel du n°2 (`magazine_actif` non vérifié) est corrigé le 2026-10-22 (R14 résolu).
- Les rebonds différés (adresse acceptée puis abandonnée par le destinataire) ne remontent pas à l’application :
  « Envoyés » signifie accepté par le serveur d’envoi ; seule une adresse qui ressemble à une faute de frappe est
  signalée.
- Email n°3 absent de la liste des invités et de son export (R15 de [risques-et-dette](../project/risques-et-dette.md)).
