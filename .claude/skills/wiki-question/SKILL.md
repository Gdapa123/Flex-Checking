---
name: wiki-question
description: Répond à une question sur Flex’Checking à partir du wiki « cerveau » (index puis pages), vérifie dans le code, cite ses sources, et propose de classer la réponse comme nouvelle page si elle a une valeur durable.
argument-hint: <question>
disable-model-invocation: true
---

# /wiki-question — interroger le wiki

Question : **$ARGUMENTS**

## Étapes

1. Lis `Cerveau/index.md` et repère les pages pertinentes ; lis-les.
2. **Vérifie dans le code** les points dont dépend la réponse (le wiki peut être en retard : la date `verifie` et le
   `commit` de chaque page l’indiquent). En cas d’écart, le code fait foi : signale l’écart et propose `/wiki-maj`.
3. Réponds en français, de façon directe, en citant les pages (`Cerveau/…`) et les fichiers de code (`chemin:symbole`).
   Forme adaptée à la question : explication, tableau comparatif, liste d’étapes, schéma texte.
4. Distingue ce qui est vérifié de ce qui est supposé ou inconnu.
5. Si la réponse a une valeur durable (analyse, comparaison, explication d’un mécanisme transverse), **propose** de
   la classer : page `Cerveau/analyses/<sujet>.md` (frontmatter `type: analyse`), lien depuis l’index et les pages
   liées, entrée `## [AAAA-MM-JJ] question | <sujet>` dans `Cerveau/log.md`. Ne l’écris qu’avec l’accord de
   l’utilisateur, sauf s’il l’a demandé dans sa question.

Ne modifie pas le code.
