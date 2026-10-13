---
name: wiki-lint
description: Contrôle de santé du wiki « cerveau » de Flex’Checking — liens cassés, pages périmées par rapport au code, orphelines, contradictions, concepts sans page, risques résolus — puis propose ou applique les corrections.
argument-hint: [corriger]  (sans argument : rapport seulement)
disable-model-invocation: true
---

# /wiki-lint — contrôle de santé du wiki

Mode : **$ARGUMENTS** (vide = rapport seulement ; « corriger » = appliquer les corrections sûres).

## Étapes

1. **Contrôles automatiques** : `python3 Cerveau/outils/lint_wiki.py`
   (liens cassés, frontmatter, sources introuvables, pages absentes de l’index, orphelines, pages périmées).
2. **Contrôles de lecture** (par l’agent) :
   - pages à revérifier : relire le diff des commits signalés et dire ce qui est devenu faux ;
   - contradictions entre pages (ex. une limite de débit ou une règle différente dans deux pages) ;
   - contradictions avec le code sur un échantillon de règles critiques : `services.inscrire`, `services.emarger`,
     `emails.magazine_deja_parti`, permissions (`apps/comptes/permissions.py`), limites (`config/settings.py`) ;
   - concepts ou modules cités sans page, fonctionnalités du code absentes du wiki
     (comparer `backend/apps/noyau/urls.py` et `frontend/src/App.jsx` avec `api/endpoints.md` et `features/`) ;
   - entrées de `project/risques-et-dette.md` résolues dans le code ;
   - décisions `proposée` restées sans suite ;
   - `README.md` et `PLAN.md` en désaccord avec le wiki (à signaler, pas à modifier).
3. **Rapport** classé : erreurs, pages à revérifier, incohérences, manques, suggestions (questions à creuser,
   sources à ajouter).
4. **Si mode « corriger »** : corrige liens, index, frontmatter et contenus périmés **vérifiés dans le code** ;
   ne tranche jamais une contradiction métier sans l’utilisateur (la noter à la place). Relance le script.
5. **Journal** : entrée `## [AAAA-MM-JJ] lint | <résumé>` en bas de `Cerveau/log.md` (y compris en mode rapport,
   avec le nombre de problèmes trouvés).

Ne modifie aucun fichier hors de `Cerveau/`.
