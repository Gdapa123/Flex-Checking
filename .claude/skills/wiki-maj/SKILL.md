---
name: wiki-maj
description: Met le wiki « cerveau » de Flex’Checking à jour avec les changements de code (commits récents, diff en cours ou fonctionnalité qu’on vient de développer), en ne touchant que les pages concernées.
argument-hint: [plage de commits, fichier, ou « en cours » ; vide = tout ce qui a changé depuis la dernière vérification]
disable-model-invocation: true
---

# /wiki-maj — synchroniser le wiki avec le code

Périmètre demandé : **$ARGUMENTS** (vide = tout ce qui a changé depuis le dernier commit consigné).

Lis `Cerveau/CLAUDE.md` puis `Cerveau/index.md`.

## Étapes

1. **Trouver ce qui a changé**
   - lance `python3 Cerveau/outils/lint_wiki.py` : la section « PAGES À REVÉRIFIER » liste les pages dont les
     fichiers sources ont changé depuis leur commit de vérification, avec les commits en cause ;
   - selon le périmètre : `git log --stat <plage>`, `git diff` (modifications en cours), ou les fichiers indiqués ;
   - lis réellement les diffs et le code modifié — jamais seulement les messages de commit.
2. **Mettre à jour chaque page concernée** : règles, fichiers, routes, validations, tests, limites. Corrige ce qui
   est devenu faux, ajoute ce qui est nouveau, mets à jour `verifie` (date du jour), `commit` (hash court de HEAD ; les modifications non
   commitées sont signalées par le script tant qu’elles ne sont pas commitées, puis il suffit de relancer `/wiki-maj`) et `sources`.
3. **Nouvelle fonctionnalité** → nouvelle page depuis `Cerveau/templates/feature-template.md`.
   **Décision structurante** → ADR depuis `Cerveau/templates/decision-template.md` (statut `proposée` si non validée
   par l’utilisateur ; une décision remplacée garde son historique et pointe vers la nouvelle).
   **Bug corrigé** → note depuis `Cerveau/templates/bug-template.md` si l’explication est utile pour la suite.
4. **Risques** : retire de `project/risques-et-dette.md` ce qui est résolu (en le notant), ajoute ce qui apparaît.
5. **Tests** : si des contrôles ont été lancés, mets à jour le tableau « Dernière exécution » de
   `testing/test-strategy.md` avec les résultats réels (jamais un test non exécuté).
6. **Index** si des pages ont été créées, déplacées ou supprimées.
7. **Journal** : entrée `## [AAAA-MM-JJ] <catégorie> | <titre>` en bas de `Cerveau/log.md`.
8. **Contrôle** : relance `python3 Cerveau/outils/lint_wiki.py` → 0 erreur et 0 page à revérifier pour le périmètre.

## Règles
- Le code fait foi ; ne documente rien qui ne soit vérifié.
- Ne modifie aucun fichier hors de `Cerveau/`.

## Rendu
Pages mises à jour ou créées (et pourquoi), décisions ou risques ajoutés/retirés, résultat du contrôle.
