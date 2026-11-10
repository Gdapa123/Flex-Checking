---
type: project
statut: implémenté
verifie: 2026-11-10
commit: 93646d7
sources: [PLAN.md, README.md, frontend/src/features/invite/EtatCarte.jsx, infra/vps/mettre-a-jour.sh, infra/vps/installer.sh, docker-compose.prod.yml, infra/Caddyfile.prod]
---

# Périmètre

## Origine
- Cahier des charges : long prompt en français fourni le 2026-10-09 (**non présent dans le dépôt** ❓ ; seul
  `PLAN.md` en garde la trace).
- Design : projet Claude Design `90947bde-ee2e-419b-aa1c-5a1339b40b81`, copié en lecture seule dans
  `design-source/` (référence, non déployée). Direction retenue : « 2a ».
- `PLAN.md` (phase 0) a été validé intégralement le 2026-10-09, y compris les propositions Q1 à Q4.
- Règle d’arbitrage (PLAN §7) : **le cahier des charges l’emporte pour le métier, les données et la technique ;
  le design l’emporte pour l’apparence.** 26 contradictions C1–C26 y sont listées avec leur décision.

## Dans le périmètre (✅ implémenté)
- Écrans invité I1–I8 (sauf I7 « adresse déjà inscrite », retiré le 2026-11-02 : [ADR-005](../decisions/ADR-005-anti-enumeration-inscription.md)), scan S1–S12, admin A1–A7, super admin SA1–SA9 (numérotation de `PLAN.md` §2).
- Ajouts postérieurs au plan, tous implémentés : écran de présentation des étapes avant le formulaire,
  analyses et rapports PDF, erreurs techniques (super admin), temps réel WebSocket, suppressions définitives
  (super admin), page « Infos pratiques », environnement de test Vercel ; puis, en novembre 2026 : « Invités à
  contacter » dans le suivi des emails (A7), carte d’invitation téléversée ([ADR-016](../decisions/ADR-016-carte-invitation-en-base.md)),
  email n°2 envoyé à tout invité présent avec boutons selon les liens, politique de confidentialité au texte de MDE,
  rechargement automatique des onglets ouverts après une mise à jour.

## Hors périmètre (décisions explicites)
- Aucun compte invité.
- Pas de réinitialisation de mot de passe en libre-service (Q2) : « Mot de passe oublié ? » renvoie vers la
  direction des événements.
- Pas d’invitation d’admin par email (Q1) : mot de passe temporaire affiché une fois.
- Rôle « Hôte scan » du design → simple `ADMIN` affecté (C2).
- Pas de visuel de couverture dans l’email n°2 (C19).

## Inconnus ❓
- ~~Hébergement de production réel~~ : tranché. Domaine `inscription.mde.ci` (valeur par défaut de
  `docker-compose.prod.yml` et `infra/Caddyfile.prod`, exemple de `infra/vps/installer.sh`) sur un VPS Lite Infomaniak
  (scripts `infra/vps/`, guides [deploiement-infomaniak](../operations/deploiement-infomaniak.md) et
  [deploiement-vps-facile](../operations/deploiement-vps-facile.md)) : installé les 2026-11-04/05, mis à jour par
  `infra/vps/mettre-a-jour.sh` à chaque version (dernière consignée : `e75bba3`, 2026-11-10, voir [log](../log.md)).
  Sauvegardes automatiques **non activées** au 2026-11-10 ([risques R31](risques-et-dette.md)).
- Fournisseur SMTP de production : compte Google Workspace `noreply@mde.ci` (`smtp.gmail.com`) annoncé le 2026-11-06
  (journal) ; configuration faite par l’utilisateur, non vérifiée par l’agent (à confirmer).
- Logo officiel MDE distinct du logo Flex’Checking (Q3 posée ; le logo Flex’Checking est utilisé partout).
- Nombre réel d’invités et de cérémonies par an.
