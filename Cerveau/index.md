---
type: index
verifie: 2026-10-22
commit: be899ff
---

# Flex’Checking — index du wiki

Point d’entrée de la documentation. L’agent lit cette page en premier pour répondre à une question, puis les
pages pertinentes, puis vérifie dans le code. Toutes les pages ont été revérifiées le 2026-10-21 sur le commit `be899ff` ; les pages touchées par l'audit de
durcissement du 2026-10-22 (modifications non commitées) l'ont été de nouveau ce jour-là.

## Règles
| Page | Description |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Schéma du wiki, règles de développement, sécurité, tests, cycle de travail, format du journal |
| [log.md](log.md) | Journal chronologique des évolutions (ajout seul) |

## Commandes du wiki
`/wiki-ingest` (ajouter une source) · `/wiki-maj` (synchroniser avec le code) · `/wiki-question` (interroger) ·
`/wiki-lint` (contrôle de santé) · `/wiki-journal` (activité récente). Détail : [CLAUDE.md](CLAUDE.md) §4.
Contrôle automatique : `python3 Cerveau/outils/lint_wiki.py`.

## Projet
| Page | Description |
|---|---|
| [project/overview.md](project/overview.md) | Finalité, parcours de l’invité, les quatre espaces, notions métier |
| [project/scope.md](project/scope.md) | Origine (cahier des charges, design, PLAN), périmètre, hors périmètre, inconnus |
| [project/roadmap.md](project/roadmap.md) | Historique des étapes et prochaines étapes proposées |
| [project/risques-et-dette.md](project/risques-et-dette.md) | Risques R1–R24 (R1, R13, R14, R17 résolus ; R7 atténué) et limitations assumées |

## Architecture
| Page | Description |
|---|---|
| [architecture/system-overview.md](architecture/system-overview.md) | Schéma du système, couches backend/frontend, principes, environnements |
| [architecture/components.md](architecture/components.md) | Rôle de chaque fichier backend et dossier frontend |
| [architecture/data-model.md](architecture/data-model.md) | Entités, contraintes, index, suppressions en cascade |
| [architecture/integrations.md](architecture/integrations.md) | SMTP, Redis, agenda, cartes, caméra, Vercel, Neon |

## Fonctionnalités
| Page | Description |
|---|---|
| [features/inscription.md](features/inscription.md) | Lien public, présentation, formulaire, états, confirmation, infos pratiques |
| [features/emails.md](features/emails.md) | Emails n°1, n°2 et n°3 : déclencheurs, envoi Celery, relances, modèles, gabarits |
| [features/sondage-satisfaction.md](features/sondage-satisfaction.md) | Email n°3 : sondage le lendemain à 8 h, lien 24 h, une réponse par email et par appareil, analyses |
| [features/donnees-personnelles.md](features/donnees-personnelles.md) | Politique de confidentialité, durée de conservation, anonymisation automatique des invités |
| [features/scan-emargement.md](features/scan-emargement.md) | Configuration du poste, dispositions, règle d’émargement, annulation, résultat |
| [features/hors-ligne.md](features/hors-ligne.md) | File IndexedDB, synchronisation, dernier compte connu |
| [features/tableau-de-bord.md](features/tableau-de-bord.md) | Choix de la cérémonie, tableau de bord temps réel, aperçu des emails, rapport |
| [features/gestion-invites.md](features/gestion-invites.md) | Liste, recherche, filtres, tri, actions groupées, fiche, ajout |
| [features/configuration-super-admin.md](features/configuration-super-admin.md) | Programmes, cérémonies, comptes, paramètres, journal, garde-fous |
| [features/authentification.md](features/authentification.md) | Rôles, connexion, cookies JWT, CSRF, révocation, mot de passe temporaire |
| [features/temps-reel.md](features/temps-reel.md) | WebSocket, sujets, groupes, reconnexion, interrogation de secours |
| [features/erreurs-techniques.md](features/erreurs-techniques.md) | Capture, regroupement, masquage, écran super admin |
| [features/exports-rapports.md](features/exports-rapports.md) | Exports CSV/Excel, rapports PDF, analyses |

## Spécifications
| Page | Description |
|---|---|
| [specifications/functional-requirements.md](specifications/functional-requirements.md) | EF-01 à EF-25 avec leur preuve (test ou fichier) |
| [specifications/non-functional-requirements.md](specifications/non-functional-requirements.md) | Sécurité, limites de débit, charge, résilience, accessibilité, localisation |

## API
| Page | Description |
|---|---|
| [api/endpoints.md](api/endpoints.md) | Toutes les routes REST avec droits, paramètres et réponses ; WebSocket |

## Décisions
| Page | Statut | Description |
|---|---|---|
| [decisions/ADR-001-stack-et-arbitrage.md](decisions/ADR-001-stack-et-arbitrage.md) | acceptée | Stack imposée ; le cahier des charges prime sur le design pour le métier |
| [decisions/ADR-002-jwt-cookies-httponly.md](decisions/ADR-002-jwt-cookies-httponly.md) | acceptée | Sessions JWT en cookies httpOnly + CSRF + version de session |
| [decisions/ADR-003-comptes-mot-de-passe-temporaire.md](decisions/ADR-003-comptes-mot-de-passe-temporaire.md) | acceptée | Comptes créés avec mot de passe temporaire, pas de libre-service |
| [decisions/ADR-004-email-2-une-seule-fois.md](decisions/ADR-004-email-2-une-seule-fois.md) | acceptée | Email n°2 jamais redéclenché automatiquement |
| [decisions/ADR-005-anti-enumeration-inscription.md](decisions/ADR-005-anti-enumeration-inscription.md) | acceptée | Doublon d’inscription = même réponse qu’un succès (remplace PLAN C8) |
| [decisions/ADR-006-temps-reel-sujets-sans-donnees.md](decisions/ADR-006-temps-reel-sujets-sans-donnees.md) | acceptée | WebSocket qui annonce des sujets, rechargement par l’API |
| [decisions/ADR-007-environnement-test-vercel.md](decisions/ADR-007-environnement-test-vercel.md) | acceptée | Test en ligne sur Vercel + Neon, sans Redis |
| [decisions/ADR-008-borne-recherche-restreinte.md](decisions/ADR-008-borne-recherche-restreinte.md) | acceptée | Borne : recherche ≥ 3 lettres, emails masqués |
| [decisions/ADR-009-file-attente-concurrence.md](decisions/ADR-009-file-attente-concurrence.md) | acceptée | File d’attente ASGI pour borner les connexions MySQL |
| [decisions/ADR-010-mode-borne-serveur.md](decisions/ADR-010-mode-borne-serveur.md) | acceptée | Borne libre-service : session restreinte côté serveur, élévation par le mot de passe de l’hôte |
| [decisions/ADR-011-annulation-reservee-super-admin.md](decisions/ADR-011-annulation-reservee-super-admin.md) | acceptée | Annuler un émargement ou une présence : super admin uniquement |
| [decisions/ADR-012-sondage-satisfaction.md](decisions/ADR-012-sondage-satisfaction.md) | acceptée | Sondage : lien personnel 24 h, une réponse par email et par appareil, Beat ou cron |
| [decisions/ADR-013-conservation-limitee-anonymisation.md](decisions/ADR-013-conservation-limitee-anonymisation.md) | acceptée | Données personnelles : anonymisation automatique après une durée réglable |

## Tests
| Page | Description |
|---|---|
| [testing/test-strategy.md](testing/test-strategy.md) | Niveaux, outils, configuration, CI, dernières exécutions |
| [testing/test-cases.md](testing/test-cases.md) | Correspondance fichiers de test ↔ fonctionnalités, zones non couvertes |

## Exploitation
| Page | Description |
|---|---|
| [operations/setup.md](operations/setup.md) | Docker Compose, développement sans Docker, données de démo, variables |
| [operations/deployment.md](operations/deployment.md) | Production Docker, environnement Vercel, tests de charge |
| [operations/deploiement-infomaniak.md](operations/deploiement-infomaniak.md) | Guide pas à pas : VPS Lite Infomaniak, toutes les fonctionnalités au moindre coût |

## Gabarits
[feature](templates/feature-template.md) · [décision](templates/decision-template.md) ·
[bug](templates/bug-template.md) · [note technique](templates/technical-note-template.md)

## Sources brutes (hors wiki, jamais modifiées par le wiki)
`README.md` (exploitation détaillée), `PLAN.md` (plan validé, contradictions C1–C26), `design-source/` (maquettes),
`infra/charge/README.md` (tests de charge), le code de `backend/`, `frontend/`, `infra/`, `shared/`.
