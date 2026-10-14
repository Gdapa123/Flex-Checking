---
type: decision
statut: acceptée
verifie: 2026-10-14
commit: 36389e6
sources: [backend/apps/noyau/sondages.py, backend/apps/noyau/vues_sondage.py, backend/config/settings.py, backend/vercel.json]
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
5. Questionnaire fixe (3 notes + commentaire) ; texte de l'email modifiable par le super admin.
6. **Anonymat réel** (audit du 2026-10-14) : réponse sans lien vers l'invité, indicateur `repondu` sans heure sur le
   lien, heure de réponse arrondie ; cookie d'appareil limité à 30 jours ; aucun email de sondage envoyé après la
   clôture du lien ni à un invité dont la présence a été annulée (contrôle dans `tasks._envoyer`).

## Limites assumées
- Navigation privée + nouvel appareil = un nouvel avis possible pour une autre personne ; mais un **lien** ne
  sert qu'une fois, donc au plus une réponse par invité présent.
- Effacer cookies **et** stockage du navigateur permet de répondre depuis le même appareil avec un **autre** lien
  (celui d'un autre invité) : risque faible, accepté.
