---
type: decision
statut: acceptée
verifie: 2026-10-26
commit: 2523cbb
sources: [backend/apps/noyau/sondages.py, backend/apps/noyau/vues_invites.py, backend/apps/noyau/vues_sondage.py, backend/apps/noyau/models.py, backend/apps/noyau/tasks.py, backend/apps/noyau/suivi_emails.py, backend/config/settings.py, backend/vercel.json]
---

# ADR-012 — Sondage de satisfaction : lien personnel de 24 h, unicité par email et par appareil

- **Date** : 2026-10-14 (demande de l'utilisateur)
- **Statut** : acceptée

## Contexte
Envoyer aux présents, le lendemain vers 8 h, un sondage dont le lien vaut 24 h ; au-delà, un message « sondage
passé » avec remerciements ; résultats dans les tableaux de bord ; « un appareil ou un mail ne peut envoyer un
sondage qu'une seule fois ».

## Décisions
1. **Lien personnel** (jeton aléatoire de 32 caractères) créé à l'envoi ; fenêtre de 24 h comptée **depuis la
   création du lien** (un envoi rattrapé à 11 h reste ouvert jusqu'au lendemain 11 h).
2. **Unicité par email** : un lien par invité, une réponse par lien.
3. **Unicité par appareil** : cookie httpOnly posé par le serveur + identifiant du navigateur, conservés hachés ;
   l'adresse IP n'est **pas** utilisée (les invités partagent le Wi-Fi du lieu ou d'une entreprise).
4. **Orchestration** : Celery Beat en production (8 h puis rattrapage horaire jusqu'à 20 h) ; cron Vercel protégé
   par `CRON_SECRET` sur l'environnement de test. Tâche idempotente.
   Mise en œuvre (`be899ff`) : deux crons Vercel, 8 h et 12 h, sur des chemins distincts
   (`/api/taches-planifiees/sondages/?passage=8h` et `?passage=12h`) car Vercel fusionne deux crons d'un même chemin ;
   le paramètre `passage` n'est pas lu par le serveur. Sans file, les liens et emails « en attente » sont créés
   d'abord puis envoyés dans un budget de 200 s ; le cron de 12 h reprend le reste.
5. Questionnaire fixe (3 notes + commentaire) ; texte de l'email modifiable par le super admin.
6. **Anonymat réel** (audit du 2026-10-14) : réponse sans lien vers l'invité, indicateur `repondu` sans heure sur le
   lien, heure de réponse arrondie ; cookie d'appareil limité à 30 jours ; aucun email de sondage envoyé après la
   clôture du lien ni à un invité dont la présence a été annulée (contrôle dans `tasks._envoyer`).

## Vérification (2026-10-21, `be899ff`)
Le code est conforme aux décisions 1 à 6 : jeton `secrets.token_urlsafe(24)` (32 caractères), `expire_le =
création + 24 h`, `InvitationSondage` `OneToOne`, contrainte unique `(evenement, appareil)`, aucune utilisation de
l'IP pour l'unicité (l'IP ne sert qu'à la limite de débit de 60/h), `tasks._sondage_perime`. Le renvoi manuel
(fiche ou A7) réutilise le même lien.

Mise à jour du 2026-10-22 (commits `d91d426` puis `7e0e071`) : le renvoi n'est plus conditionné à l'absence de
réponse, pour préserver l'anonymat. Le renvoi **individuel** depuis la fiche (`vues_invites.RenvoiEmailView`) exige
un lien ouvert et un dernier envoi n°3 en échec (`sondages.sondage_renvoyable`) ; le renvoi groupé de A7
(`suivi_emails.renvoyer_echecs`) reprend les échecs dont le lien est ouvert. Dans les deux cas, le traitement est
identique que l'invité ait répondu ou non (réponse, journal, envoi réel, statut ; `sondage_repondu` supprimé) :
un invité qui a déjà répondu peut recevoir de nouveau son lien, qui affiche « déjà répondu ». Commentaire :
caractères de contrôle refusés (`validation.sans_controle_multiligne`).

## Limites assumées
- Navigation privée + nouvel appareil = un nouvel avis possible pour une autre personne ; mais un **lien** ne
  sert qu'une fois, donc au plus une réponse par invité présent.
- Effacer cookies **et** stockage du navigateur permet de répondre depuis le même appareil avec un **autre** lien
  (celui d'un autre invité) : risque faible, accepté.
- Corollaire : deux invités qui utilisent le **même téléphone** ne peuvent pas répondre tous les deux (le second
  reçoit `APPAREIL_DEJA_UTILISE`) ; accepté (R23 de [risques-et-dette](../project/risques-et-dette.md)).
