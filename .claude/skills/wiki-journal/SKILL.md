---
name: wiki-journal
description: Affiche les dernières entrées du journal du wiki « cerveau » et l’état du wiki (pages à revérifier), ou ajoute une entrée manuelle au journal.
argument-hint: [nombre d’entrées | « ajouter » <texte>]
disable-model-invocation: true
---

# /wiki-journal — consulter ou compléter le journal

Argument : **$ARGUMENTS**

- **Vide ou un nombre N** (défaut 5) :
  1. `grep "^## \[" Cerveau/log.md | tail -N` puis affiche le contenu de ces entrées, résumé ;
  2. `python3 Cerveau/outils/lint_wiki.py` et indique en une ligne s’il y a des pages à revérifier ou des erreurs.
- **« ajouter » suivi d’un texte** : ajoute en bas de `Cerveau/log.md` une entrée au format du schéma
  (`Cerveau/CLAUDE.md` §10) à partir du texte ; ne prétends jamais qu’un test, commit ou déploiement a eu lieu si
  l’utilisateur ne l’a pas indiqué ou si tu ne l’as pas constaté.
