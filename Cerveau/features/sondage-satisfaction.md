---
type: feature
statut: implémenté
verifie: 2026-10-14
commit: 36389e6
sources: [backend/apps/noyau/sondages.py, backend/apps/noyau/vues_sondage.py, backend/apps/noyau/models.py, backend/apps/noyau/tasks.py, backend/config/settings.py, backend/vercel.json, backend/templates/emails/sondage.html, frontend/src/features/invite/SondagePage.jsx, frontend/src/features/admin/CarteSatisfaction.jsx, frontend/src/features/super/Analyses.jsx]
---

# Sondage de satisfaction (email n°3)

Demande de l'utilisateur du 2026-10-14. Décision : [ADR-012](../decisions/ADR-012-sondage-satisfaction.md).

## Règles
| Règle | Mise en œuvre |
|---|---|
| Envoyé aux seuls **présents**, le **lendemain de la cérémonie vers 8 h** (Abidjan, UTC+0) | `sondages.planifier_sondages` : cérémonies `date = veille`, invités `PRESENT` sans lien ; rien avant 8 h |
| Programme désactivable | `Programme.sondage_actif` (défaut vrai), interrupteur dans Programmes (SA4) |
| Un seul envoi par invité | `InvitationSondage` (unique par invité, `OneToOne`) ; tâche idempotente, verrou de cache |
| Lien **valable 24 h** | `expire_le = cree_le + 24 h` ; page publique « clos » au-delà, réponse refusée (410 `SONDAGE_EXPIRE`) |
| **Une réponse par email** | `ReponseSondage` unique par lien (409 `DEJA_REPONDU`) |
| **Une réponse par appareil** et par cérémonie | cookie `fc_appareil` (httpOnly, 30 jours, posé par le serveur) **et** identifiant du navigateur (`localStorage` `fc-appareil`) ; empreintes SHA-256 `evenement:identifiant` ; contrainte unique `(evenement, appareil)` ; 409 `APPAREIL_DEJA_UTILISE` |
| Analyses pour admins et super admin | `GET evenements/<id>/sondage/` (admin de la cérémonie), `GET analytique/sondages/` (super admin) |

**Réponses anonymes en base** (2026-10-14) : `ReponseSondage` n'a aucun lien vers l'invité ni le lien ; le lien ne
garde qu'un indicateur `repondu` (sans heure) ; l'heure de la réponse est arrondie à l'heure ; les tableaux de bord
n'affichent que le jour des commentaires. La suppression d'un invité laisse sa réponse anonyme dans les résultats.
Lien clos : l'API ne renvoie plus ni prénom ni civilité. Jeton masqué dans les journaux (Uvicorn, Caddy, erreurs
techniques, signalements du navigateur).

## Questionnaire (page publique `/sondage/<jeton>`)
1. Satisfaction générale : 1 à 5 étoiles (Décevante → Excellente).
2. Accueil à l'arrivée : 1 à 5 étoiles.
3. « Recommanderiez-vous MDE Business School à un proche ? » : 0 à 10 (sert au NPS).
4. Commentaire facultatif (1 000 caractères).

États : `OUVERT` (formulaire), `REPONDU` (remerciement), `EXPIRE` → **fenêtre « Le temps du sondage est passé »**
(dialogue modal en dégradé du programme, sablier, remerciements, bouton Fermer ; puis rappel « Le sondage est clos »),
appareil déjà utilisé (remerciement), lien inconnu (page « lien de sondage non valide »). Couleurs du programme
(`ThemeScope`). Limite : 60 requêtes/h par IP (`sondage`).

## Orchestration
| Environnement | Déclencheur |
|---|---|
| Production (Docker) | Celery Beat `envoyer-sondages` : `crontab(minute=0, hour="8-20")` — 8 h, puis rattrapage horaire jusqu'à 20 h (présence validée tard, Beat indisponible à 8 h) ; l'email part par le worker Celery (3 relances) |
| Test Vercel (sans Redis) | crons Vercel `0 8 * * *` et `0 12 * * *` (`backend/vercel.json`, chemins distincts `?passage=8h` / `?passage=12h` : Vercel fusionne deux crons d'un même chemin) → `GET /api/taches-planifiees/sondages/` avec `Authorization: Bearer <CRON_SECRET>` (≥ 32 caractères, sinon 404) ; liens et emails « en attente » créés d'abord, puis envoyés dans un budget de 200 s ; le cron de 12 h reprend le reste et les présences tardives |

Une cérémonie dont le lendemain est passé sans déclenchement n'est **pas** rattrapée ensuite (règle « le lendemain »).

## Email n°3
Gabarit `templates/emails/sondage.html` / `.txt` : carte « Votre avis en 3 questions », bouton « Donner mon avis »,
date de clôture. Objet et contenu modifiables (Paramètres, onglet « Email n°3 · sondage », variable
`{lien_sondage}`). Suivi dans l'écran A7 (compteurs, échecs, renvoi groupé, email de test) ; renvoi possible
seulement pendant les 24 h et avant réponse (`sondages.sondage_renvoyable`).

## Analyses
- **A3** (tableau de bord admin) : carte « Satisfaction des participants » (`CarteSatisfaction.jsx`) — état (à
  venir, en cours, clos, désactivé), réponses et taux, moyennes sur 5, NPS et libellé, répartition des notes,
  promoteurs / passifs / détracteurs, 20 derniers commentaires. Temps réel (sujet `sondage`).
- **Super admin** : Analyses › onglet « Satisfaction » (cumul et tableau par cérémonie).
- **Rapport PDF** de la cérémonie : section « Satisfaction des participants » dès le premier envoi.
- NPS = % de notes 9-10 − % de notes 0-6.

## Tests
`backend/apps/noyau/tests/test_sondage.py` (16) ; `frontend/tests/sondage.test.jsx` (6) ; `suiviEmails.test.jsx`.
