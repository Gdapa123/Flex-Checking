---
type: feature
statut: implémenté
verifie: 2026-10-26
commit: 44eceb5
sources: [backend/apps/noyau/vues_invites.py, backend/apps/noyau/validation.py, frontend/src/lib/schemas.js, backend/apps/noyau/tests/test_durcissement.py, backend/apps/noyau/sondages.py, backend/apps/noyau/vues_sondage.py, backend/apps/noyau/models.py, backend/apps/noyau/tasks.py, backend/apps/noyau/urls.py, backend/apps/noyau/vues_admin.py, backend/apps/noyau/suivi_emails.py, backend/apps/noyau/rapports.py, backend/apps/noyau/logs.py, backend/apps/noyau/temps_reel.py, backend/config/settings.py, backend/vercel.json, backend/templates/emails/sondage.html, backend/templates/emails/sondage.txt, backend/apps/noyau/tests/test_sondage.py, frontend/src/App.jsx, frontend/src/lib/signalement.js, frontend/src/lib/tempsReel.js, infra/Caddyfile.prod, frontend/src/features/invite/SondagePage.jsx, frontend/src/features/admin/CarteSatisfaction.jsx, frontend/src/features/super/Analyses.jsx]
---

# Sondage de satisfaction (email n°3)

Demande de l'utilisateur du 2026-10-14. Décision : [ADR-012](../decisions/ADR-012-sondage-satisfaction.md).

## Règles
| Règle | Mise en œuvre |
|---|---|
| Envoyé aux seuls **présents**, le **lendemain de la cérémonie vers 8 h** (Abidjan, UTC+0) | `sondages.planifier_sondages` : cérémonies `date = veille`, invités `PRESENT` sans lien ; rien avant 8 h |
| Programme désactivable | `Programme.sondage_actif` (défaut vrai), interrupteur dans Programmes (SA4) |
| Un seul envoi par invité | `InvitationSondage` (unique par invité, `OneToOne`, jeton `secrets.token_urlsafe(24)`) ; tâche idempotente (`IntegrityError` ignorée), verrou de cache `sondages-envoi` (10 min) |
| Lien **valable 24 h** | `expire_le = cree_le + 24 h` ; page publique « clos » au-delà, réponse refusée (410 `SONDAGE_EXPIRE`) |
| **Une réponse par email** | `ReponseSondage` unique par lien (409 `DEJA_REPONDU`) |
| **Une réponse par appareil** et par cérémonie | cookie `fc_appareil` (httpOnly, `SameSite=Lax`, chemin `/api/public/sondages/`, 30 jours, posé par le serveur à la lecture) **et** identifiant du navigateur (`localStorage` `fc-appareil`, 16 à 64 caractères `[A-Za-z0-9_-]`) ; empreintes SHA-256 `evenement:identifiant` comparées aux deux colonnes `appareil` / `appareil_local` ; contrainte unique `(evenement, appareil)` ; 409 `APPAREIL_DEJA_UTILISE` ; 400 si aucun des deux identifiants |
| Analyses pour admins et super admin | `GET /api/evenements/<id>/sondage/` (`EstAdmin`, cérémonies visibles), `GET /api/analytique/sondages/` (`EstSuperAdmin`) |

Points d’accès publics : `GET` / `POST /api/public/sondages/<jeton>/` (`SondagePublicView`, sans authentification,
`Cache-Control: no-store` en lecture, 404 si jeton inconnu) ; notes validées 1-5, 1-5, 0-10, commentaire ≤ 1 000
sans caractère de contrôle hors sauts de ligne et tabulation (`validation.sans_controle_multiligne`, 2026-10-22 ;
miroir `CONTROLE_MULTILIGNE_RE` dans `frontend/src/lib/schemas.js`, caractères retirés avant envoi par
`SondagePage.jsx`).

**Réponses anonymes en base** (2026-10-14) : `ReponseSondage` n'a aucun lien vers l'invité ni le lien ; le lien ne
garde qu'un indicateur `repondu` (sans heure) ; l'heure de la réponse est arrondie à l'heure ; les tableaux de bord
n'affichent que le jour des commentaires. La suppression d'un invité laisse sa réponse anonyme dans les résultats.
Dès que le lien n'est plus `OUVERT` (répondu ou expiré), l'API ne renvoie plus ni prénom ni civilité. Jeton masqué dans les journaux : `logs.JETON_SONDAGE_RE` (journaux applicatifs / Uvicorn),
`infra/Caddyfile.prod`, signalements du navigateur (`signalement.normaliserLieu` → `/sondage/:jeton`).

## Questionnaire (page publique `/sondage/<jeton>`)
1. Satisfaction générale : 1 à 5 étoiles (Décevante → Excellente).
2. Accueil à l'arrivée : 1 à 5 étoiles.
3. « Recommanderiez-vous MDE Business School à un proche ? » : 0 à 10 (sert au NPS).
4. Commentaire facultatif (1 000 caractères).

États : `OUVERT` (formulaire), `REPONDU` (remerciement), `EXPIRE` → **fenêtre « Le temps du sondage est passé »**
(dialogue modal en dégradé du programme, sablier, remerciements, bouton Fermer ; puis rappel « Le sondage est clos »),
appareil déjà utilisé (remerciement), lien inconnu (`LienInvalide` avec titre / texte propres au sondage). Couleurs du programme
(`ThemeScope`). Limite : 60 requêtes/h par IP (`sondage`).

## Orchestration
| Environnement | Déclencheur |
|---|---|
| Production (Docker) | Celery Beat `envoyer-sondages` : `crontab(minute=0, hour="8-20")` — 8 h, puis rattrapage horaire jusqu'à 20 h (présence validée tard, Beat indisponible à 8 h) ; l'email part par le worker Celery (3 relances) |
| Test Vercel (sans Redis) | crons Vercel `0 8 * * *` et `0 12 * * *` (`backend/vercel.json`, chemins distincts `?passage=8h` / `?passage=12h` : Vercel fusionne deux crons d'un même chemin) → `GET /api/taches-planifiees/sondages/` (`CronSondagesView`, sans limite de débit) avec `Authorization: Bearer <CRON_SECRET>` (≥ 32 caractères, comparaison à temps constant, sinon 404 ; le paramètre `passage` est ignoré par le serveur) ; liens et emails « en attente » créés d'abord, puis envoyés dans un budget de 200 s ; le cron de 12 h reprend le reste et les présences tardives |

Une cérémonie dont le lendemain est passé sans déclenchement n'est **pas** rattrapée ensuite (règle « le lendemain »).
Au moment de l'envoi, `tasks._envoyer` passe l'email n°3 en ECHEC sans l'envoyer si le lien est clos ou si la
présence a été annulée entre-temps (`_sondage_perime`).

## Email n°3
Gabarit `templates/emails/sondage.html` / `.txt` : carte « Votre avis en 3 questions », bouton « Donner mon avis »,
date de clôture. Objet et contenu modifiables (Paramètres, onglet « Email n°3 · sondage », variable
`{lien_sondage}`). Suivi dans l'écran A7 (compteurs, échecs, renvoi groupé, email de test).
Renvoi **individuel** (`POST /api/invites/<id>/renvoi-email/`, 2026-10-22) : seulement si le dernier envoi n°3 est en
échec et le lien encore ouvert (`sondages.sondage_renvoyable`), **indépendamment de la réponse**. Depuis `7e0e071`
(2026-10-22), le traitement est **identique que l'invité ait répondu ou non** : même réponse 202, même journal
`EMAIL_RENVOI`, email réellement renvoyé et même statut d'envoi (`sondage_repondu` supprimé) ; un admin ne peut donc
pas savoir qui a répondu. Au pire, un invité qui a déjà répondu reçoit de nouveau son lien, qui affiche « déjà
répondu ». Le renvoi groupé de A7 (`suivi_emails.renvoyer_echecs`) suit la même règle : tout invité en échec dont le
lien est ouvert est renvoyé et compté, qu'il ait répondu ou non.

## Analyses
- **A3** (tableau de bord admin) : carte « Satisfaction des participants » (`CarteSatisfaction.jsx`) — état (à
  venir, en cours, clos, désactivé), réponses et taux, moyennes sur 5, NPS et libellé, répartition des notes,
  promoteurs / passifs / détracteurs, 20 derniers commentaires. Temps réel (sujet `sondage`).
- **Super admin** : Analyses › onglet « Satisfaction » (cumul et tableau par cérémonie).
- **Rapport PDF** de la cérémonie : section « Satisfaction des participants » dès le premier envoi
  (`rapports._section_satisfaction`).
- États de la carte (`sondages.etat`) : `DESACTIVE` (aucun envoi et programme désactivé), `A_VENIR` (aucun envoi
  jusqu'à la fin du lendemain), `EN_COURS` (au moins un lien ouvert), `TERMINE`.
- Temps réel : signaux sur `InvitationSondage` (création) et `ReponseSondage` → sujet `sondage`, qui rafraîchit
  `sondage`, `sondages-global` et `suivi-emails` (`frontend/src/lib/tempsReel.js`).
- NPS = % de notes 9-10 − % de notes 0-6.

## Tests
`backend/apps/noyau/tests/test_sondage.py` (18 : envoi le lendemain aux présents, programme désactivé, rattrapage,
budget sans file puis reprise, pas d'envoi après clôture ou annulation, cron protégé, lecture, unicité par lien et par
appareil, expiration, validation, résultats et droits, suivi / renvoi, email de test et aperçu, anonymat, rapport
PDF ; caractères de contrôle du commentaire refusés) ; `test_durcissement.py`
(`test_renvoi_du_sondage_ne_revele_pas_qui_a_repondu`) ; `frontend/tests/sondage.test.jsx` (7) ; `suiviEmails.test.jsx`.

## Limites
- Un même appareil ne donne qu'un avis par cérémonie : deux invités sur un même téléphone, le second est refusé
  (`APPAREIL_DEJA_UTILISE`), choix [ADR-012](../decisions/ADR-012-sondage-satisfaction.md) — R23 de
  [risques-et-dette](../project/risques-et-dette.md).
