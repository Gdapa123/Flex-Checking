---
type: feature
statut: implémenté
verifie: 2026-10-26
commit: 44eceb5
sources: [backend/apps/noyau/tests/test_durcissement.py, backend/apps/noyau/emails.py, backend/apps/noyau/tasks.py, backend/apps/noyau/models.py, backend/apps/noyau/migrations/0011_derniere_tentative.py, backend/templates/emails/, backend/apps/noyau/icones_email.py, backend/apps/noyau/ics.py, backend/apps/noyau/qr.py, backend/apps/noyau/suivi_emails.py, backend/apps/noyau/vues_admin.py, backend/apps/noyau/vues_invites.py, backend/apps/noyau/sondages.py, backend/apps/noyau/services.py, backend/config/settings.py, frontend/src/features/admin/SuiviEmails.jsx, frontend/src/features/super/Parametres.jsx]
---

# Emails n°1 (invitation), n°2 (magazine) et n°3 (sondage)

## Quand
| Email | Déclencheur | Condition |
|---|---|---|
| n°1 · invitation | inscription publique, ajout manuel (case cochée par défaut), renvoi (public, fiche, action groupée) | toujours |
| n°2 · magazine | premier passage à Présent | programme `magazine_actif` **et** `lien_magazine` renseigné **et** aucun email MAGAZINE déjà créé pour cet invité |
| n°3 · sondage | lendemain de la cérémonie, à partir de 8 h (Beat ou cron) | invité Présent, programme `sondage_actif`, aucun lien de sondage existant ; au moment de l’envoi, `tasks._envoyer` le passe en ECHEC sans l’envoyer si le lien est clos (24 h) ou si la présence a été annulée — voir [sondage-satisfaction](sondage-satisfaction.md) |

L’email n°2 **ne repart jamais automatiquement**, même après annulation puis nouveau scan
([ADR-004](../decisions/ADR-004-email-2-une-seule-fois.md)). Renvoi manuel possible depuis la fiche (invité Présent).

Renvoi manuel depuis la fiche (`POST /api/invites/<id>/renvoi-email/`, `vues_invites.RenvoiEmailView`, 5/h par
admin et par invité) : n°2 refusé (`MAGAZINE_INDISPONIBLE`) si l’invité n’est pas Présent ou si le magazine n’est
pas disponible (`suivi_emails.magazine_disponible` : `magazine_actif` **et** `lien_magazine`, même règle que le
renvoi groupé, depuis le 2026-10-22) ;
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
  écran Paramètres, un onglet par email). Variables : `{civilite} {prenom} {nom} {programme} {annee} {date}
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
  générées par Pillow (`icones_email.py`) ; logo blanc ou rouge selon le contraste.
- Structure MIME : `mixed[ related[ alternative(texte, html), images CID ], pièces jointes ]`.
- Pièces jointes n°1 : `qr-code.png` et `graduation.ics` (aucune pièce jointe pour n°2 et n°3).
- Gabarits par type : `invitation`, `magazine`, `sondage` (`.html` + `.txt`, sur `base.html`).
- Boutons de l’email → page publique `/i/<lien>/pratique#agenda` ou `#itineraire`.
- Expéditeur : `Parametres.expediteur` (défaut « Flex’Checking · MDE Business School ») `<DEFAULT_FROM_EMAIL>`
  (`DEFAULT_FROM_EMAIL` doit donc être une adresse seule) ;
  construction commune `emails.message_depuis_rendu` (envoi réel et email de test).
- Aperçu : HTML réel avec images en data URI (`apercu=True`), rempli avec un invité d’exemple
  (`vues_admin._source_exemple`, lien de sondage factice) : `POST /api/parametres/apercu-email/` (super admin) et
  `GET /api/evenements/<id>/apercu-emails/` (les trois types, utilisé par l’aperçu replié de A7).
- Écran A7 « Suivi des emails » (`frontend/src/features/admin/SuiviEmails.jsx`, logique serveur
  `backend/apps/noyau/suivi_emails.py`) — remplace l’ancien `ApercuEmails.jsx`, supprimé dans `bd4f807` : une carte
  par email (n°1, n°2, n°3) avec compteurs envoyés / en attente / échecs (dernier envoi de chaque invité), jusqu’à
  50 échecs listés, renvoi groupé, email de test vers son propre compte, aperçu replié ; voir
  [tableau-de-bord](tableau-de-bord.md) § A7. Points d’accès (admin de la cérémonie) :
  `GET evenements/<id>/suivi-emails/`, `POST …/suivi-emails/renvoyer-echecs/` (10/h, `relance_emails`),
  `POST …/suivi-emails/test/` (10/h, `email_test`).
- Renvoi groupé : seuls les invités dont le **dernier** envoi du type est en échec ; n°2 et n°3 : seulement les
  invités encore présents ; n°3 : seulement si le lien est encore ouvert (24 h), **que l’invité ait répondu ou non**
(anonymat, `suivi_emails.renvoyer_echecs`) ; refus
  `MAGAZINE_INDISPONIBLE` / `SONDAGE_INDISPONIBLE` si l’email est désactivé pour le programme ; journal
  `EMAIL_RENVOI`. Email de test : objet préfixé « [Test] », envoi SMTP synchrone (`message.send()`), 502
  `ENVOI_IMPOSSIBLE` si le serveur SMTP échoue ; journal `EMAIL_TEST` (catégorie Email).

## Tests
`test_emails.py` (échec après 3 relances, échappement, lien en clair, boutons vers infos pratiques),
`test_emargement.py` (magazine unique), `test_analytique.py` (file indisponible, relance),
`test_suivi_emails.py` (9 : compteurs, droits, renvoi groupé, magazine désactivé, email de test, SMTP
indisponible), `test_sondage.py` (envoi, renvoi et aperçu du n°3), `test_invites.py`
(`test_renvoi_magazine_refuse_si_desactive`), `test_durcissement.py` (`test_modeles_d_email_enregistres`,
`test_variables_remplacees_en_une_seule_passe`, `test_message_id_stable_par_envoi`,
`test_relance_d_une_tentative_perdue`, `test_renvoi_du_sondage_ne_revele_pas_qui_a_repondu`) ;
`frontend/tests/suiviEmails.test.jsx`.

## Limites
- L’ancien écart du renvoi manuel du n°2 (`magazine_actif` non vérifié) est corrigé le 2026-10-22 (R14 résolu).
- Email n°3 absent de la liste des invités et de son export (R15 de [risques-et-dette](../project/risques-et-dette.md)).
