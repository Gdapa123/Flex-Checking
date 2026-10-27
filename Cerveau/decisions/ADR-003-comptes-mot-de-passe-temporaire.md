---
type: decision
statut: acceptée
verifie: 2026-10-26
commit: 2523cbb
sources: [PLAN.md, backend/apps/noyau/vues_admin.py, backend/apps/comptes/permissions.py, backend/apps/comptes/views.py, frontend/src/features/auth/ChangerMotDePasse.jsx, frontend/src/features/auth/RequireRole.jsx]
---

# ADR-003 — Création des comptes admins par mot de passe temporaire

- **Date** : 2026-10-09 (PLAN Q1 et Q2, propositions retenues)
- **Statut** : acceptée

## Contexte
Le design prévoyait une invitation par email (« Invitation envoyée ») ; le cahier des charges, une création avec
réinitialisation.

## Options
1. Lien d’activation envoyé par email.
2. **Mot de passe temporaire généré, affiché une seule fois au super admin, à changer à la première connexion.**

## Décision
Option 2, même mécanisme pour la réinitialisation. Pas de « mot de passe oublié » en libre-service : le lien
affiche la marche à suivre (contacter la direction des événements).
Renforcement du 2026-10-12 : tant que le mot de passe temporaire n’est pas changé, toute l’API est refusée
(sauf `auth/moi/`, `auth/mot-de-passe/`, déconnexion), WebSocket compris.

## Mise en œuvre (vérifiée au commit `44eceb5`)
- `AdminViewSet.create` et `AdminViewSet.reinitialiser` (`backend/apps/noyau/vues_admin.py`, super admin seul) :
  `mot_de_passe_temporaire()` (`XXXX-XXXX-XXXX`, alphabet sans caractères ambigus) renvoyé une seule fois dans
  `motDePasseTemporaire`, `doit_changer_mot_de_passe = True` ; la réinitialisation incrémente aussi
  `version_session` (sessions ouvertes fermées). Journal : `ADMIN_CREATION`, `ADMIN_MOT_DE_PASSE`.
  Depuis le 2026-10-22, la **désactivation** d'un compte incrémente aussi `version_session` (`AdminViewSet.perform_update`) :
  ses sessions ne revivent pas s'il est réactivé ([authentification](../features/authentification.md)).
- Blocage : `CompteUtilisable` refuse le compte tant que le mot de passe est temporaire (message
  `MOT_DE_PASSE_A_CHANGER`) ; seuls `auth/moi/` et `auth/mot-de-passe/` déclarent `IsAuthenticated` ; connexion,
  rafraîchissement, CSRF et déconnexion sont `AllowAny`. Frontend : `RequireRole` affiche `ChangerMotDePasse`.
- Changement (`ChangerMotDePasseView`) : 10 à 256 caractères, validateurs Django, 5/min et 30/h par compte.

## Conséquences
- ➕ aucune dépendance au SMTP pour les comptes ; aucun lien d’activation à sécuriser.
- ➖ le super admin doit transmettre le mot de passe hors de l’application.
