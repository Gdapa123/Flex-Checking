---
type: analyse
statut: partiel
verifie: 2026-11-09
commit: f55527e
sources: [backend/config/settings.py, backend/requirements.txt, backend/requirements-dev.txt, backend/apps/comptes/views.py, backend/apps/comptes/validateurs.py, backend/apps/noyau/alertes.py, backend/apps/noyau/erreurs.py, .github/workflows/ci.yml, .github/dependabot.yml]
---

# Évaluation de sécurité au regard des standards (2026-11-09)

Référentiels : **OWASP Top 10 (2021)**, **OWASP ASVS 4.0 niveau 2** (application traitant des données personnelles),
principes **ISO 27001 / NIST CSF** pour l'exploitation. Revue de code et de configuration, audits de dépendances
(`npm audit`, `pip-audit`) — **pas** un test d'intrusion externe ni un audit certifiant.

## Verdict
Code applicatif solide, proche d'ASVS niveau 2 (droits, sessions, entrées, en-têtes, données personnelles).
Exploitation en retrait le jour de l'évaluation ; les écarts traitables dans le code ont été corrigés le même jour
(voir « Suites »).

## OWASP Top 10
| Catégorie | État initial | Après corrections du 2026-11-09 |
|---|---|---|
| A01 Contrôle d'accès | ✅ permissions serveur, `evenements_visibles`, borne restreinte | inchangé |
| A02 Cryptographie | ✅ Argon2, HSTS, JWT HS256 imposé, sauvegardes AES-256 | inchangé |
| A03 Injection | ✅ ORM, validation double, contrôles, formules neutralisées, QR étrangers | inchangé |
| A04 Conception | ✅ limites de débit, garde-fous ; pas de CAPTCHA (R11/R18), codes borne (R19) | inchangé (décisions MDE) |
| A05 Configuration | 🟡 Redis sans mot de passe, images non épinglées (R22), Daphne en production | 🟡 Daphne retiré de la production ; R22 inchangé |
| A06 Composants vulnérables | ❌ DRF 3.17.2 (3 CVE), Twisted (8) et Autobahn (1) via Daphne ; aucun audit en CI | ✅ DRF 3.18.2, Daphne en dev seulement, `pip-audit` et `npm audit` bloquants en CI, Dependabot |
| A07 Authentification | 🟡 pas de MFA, pas de contrôle des mots de passe fuités | 🟡 mots de passe fuités refusés (Have I Been Pwned, k-anonymat) ; **MFA reportée** (décision de l'utilisateur) |
| A08 Intégrité | ✅ JWT infalsifiables, CI ; pas d'empreintes de paquets (R12) | inchangé |
| A09 Journalisation | 🟡 échecs de connexion non journalisés, aucune alerte | ✅ échecs et blocages journalisés, alertes email aux super admins |
| A10 SSRF | ✅ sans objet | ✅ un seul appel sortant, URL fixe (`api.pwnedpasswords.com`) |

## Écarts restants
- Double authentification (TOTP) des super admins — reportée.
- VPS `inscription.mde.ci` non mis à jour ; SPF invalide et DMARC `p=none` sur `mde.ci` (R28).
- Restauration de sauvegarde jamais testée (R27) ; Redis sans mot de passe, images non épinglées (R22).
- Plan de réponse aux incidents, conformité ARTCI (R8), test d'intrusion externe : non faits.

## Suites
Corrections du 2026-11-09 : voir [log](../log.md) et [risques R30](../project/risques-et-dette.md).
