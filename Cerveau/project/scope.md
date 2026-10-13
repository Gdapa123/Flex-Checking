---
type: project
statut: implémenté
verifie: 2026-10-13
commit: dc0c75a
sources: [PLAN.md, README.md]
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
- Écrans invité I1–I8, scan S1–S12, admin A1–A7, super admin SA1–SA9 (numérotation de `PLAN.md` §2).
- Ajouts postérieurs au plan, tous implémentés : écran de présentation des étapes avant le formulaire,
  analyses et rapports PDF, erreurs techniques (super admin), temps réel WebSocket, suppressions définitives
  (super admin), page « Infos pratiques », environnement de test Vercel.

## Hors périmètre (décisions explicites)
- Aucun compte invité.
- Pas de réinitialisation de mot de passe en libre-service (Q2) : « Mot de passe oublié ? » renvoie vers la
  direction des événements.
- Pas d’invitation d’admin par email (Q1) : mot de passe temporaire affiché une fois.
- Rôle « Hôte scan » du design → simple `ADMIN` affecté (C2).
- Pas de visuel de couverture dans l’email n°2 (C19).

## Inconnus ❓
- Domaine et hébergement de production réels (défaut de `docker-compose.prod.yml` : `emargement.mde.ci`, à confirmer).
- Fournisseur SMTP de production.
- Logo officiel MDE distinct du logo Flex’Checking (Q3 posée ; le logo Flex’Checking est utilisé partout).
- Nombre réel d’invités et de cérémonies par an.
