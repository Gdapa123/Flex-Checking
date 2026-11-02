---
type: decision
statut: acceptée
verifie: 2026-11-02
commit: d467e40
sources: [backend/apps/noyau/migrations/0008_inscriptions_pas_dans_le_futur.py, backend/apps/noyau/migrations/0010_donnees_personnelles.py, backend/apps/noyau/migrations/0011_derniere_tentative.py, docker-compose.prod.yml]
---

# ADR-014 — Migrations de schéma : convention « étendre puis contracter »

- **Date** : 2026-11-02 (traitement du risque R21)
- **Statut** : acceptée

## Contexte
Le code est déployé sur deux environnements où ancien et nouveau code peuvent tourner en même temps quelques
instants : la production Docker (redémarrage des conteneurs après `migrate`) et l'environnement de test Vercel + Neon
(migrations lancées depuis un poste avant le déploiement). Les premières migrations ajoutaient des colonnes NOT NULL
sans valeur par défaut en base, et `0008_inscriptions_pas_dans_le_futur` supprime des données. Les migrations
`0010` et `0011` suivent déjà, sans règle écrite, le schéma ci-dessous.

## Décisions
1. **Étendre** : une nouvelle colonne est ajoutée nullable, ou avec `db_default` (valeur par défaut portée par la
   base), pour que l'ancien code puisse encore insérer des lignes.
2. **Migrer** les données dans une migration séparée (`RunPython`, réversible ou `noop` documenté).
3. **Contracter** (NOT NULL, suppression de colonne ou de table, renommage) seulement dans une version ultérieure,
   une fois que plus aucun code déployé n'utilise l'ancienne forme. Un renommage se fait en ajout + copie +
   suppression, jamais en `RenameField` sur une table utilisée.
4. **Migration destructive** (suppression de données) : sauvegarde de la base juste avant (guide
   [deploiement-infomaniak](../operations/deploiement-infomaniak.md)), et mention dans le journal du wiki.
5. Ordre de déploiement : migrations appliquées **avant** le nouveau code (déjà la pratique sur Neon).
6. Une migration déjà appliquée n'est jamais modifiée (règle du [CLAUDE.md](../CLAUDE.md) §9).

## Conséquences
- Une évolution de schéma peut demander deux versions au lieu d'une ; en échange, pas d'erreur 500 pendant la
  bascule.
- La vérification reste humaine (relecture des migrations) : aucun contrôle automatique dans la CI.
- Les migrations anciennes (`0001` à `0009`) ne sont pas réécrites.
