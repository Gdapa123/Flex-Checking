#!/usr/bin/env python3
"""Contrôle de santé du wiki « cerveau » (lancé par /wiki-lint, ou à la main depuis la racine du dépôt).

    python3 Cerveau/outils/lint_wiki.py

Vérifie :
- liens Markdown internes cassés ;
- frontmatter absent ou incomplet (type, verifie, commit, sources) ;
- chemins de `sources` qui n'existent plus dans le dépôt ;
- pages absentes de index.md, pages sans aucun lien entrant (orphelines) ;
- pages périmées : fichiers de `sources` modifiés par un commit postérieur à `commit`, ou modifiés sans commit.

Sortie : un rapport lisible ; code de retour 1 si une erreur bloquante (lien cassé, source introuvable) est trouvée.
"""

import re
import subprocess
import sys
from pathlib import Path

RACINE_DEPOT = Path(__file__).resolve().parents[2]
WIKI = RACINE_DEPOT / "Cerveau"
SANS_FRONTMATTER = {"Bienvenue.md", "CLAUDE.md"}  # note par défaut d’Obsidian, schéma
HORS_ORPHELINS = {"index.md", "log.md", "CLAUDE.md", "Bienvenue.md"}
CHAMPS = ("type", "verifie", "commit", "sources")
LIEN = re.compile(r"\]\(([^)#\s]+\.md)(?:#[^)]*)?\)")


def git(*args):
    r = subprocess.run(["git", *args], cwd=RACINE_DEPOT, capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None


def frontmatter(texte):
    m = re.match(r"---\n(.*?)\n---\n", texte, re.S)
    if not m:
        return None
    champs = {}
    for ligne in m.group(1).splitlines():
        if ":" in ligne and not ligne.startswith(" "):
            cle, _, valeur = ligne.partition(":")
            champs[cle.strip()] = valeur.split("#")[0].strip()
    return champs


def sources(valeur):
    valeur = (valeur or "").strip()
    if not (valeur.startswith("[") and valeur.endswith("]")):
        return []
    return [s.strip() for s in valeur[1:-1].split(",") if s.strip() and s.strip() != "git log"]


def main():
    pages = sorted(p for p in WIKI.rglob("*.md") if ".obsidian" not in p.parts)
    relatives = {p: p.relative_to(WIKI).as_posix() for p in pages}
    index = (WIKI / "index.md").read_text(encoding="utf-8") if (WIKI / "index.md").exists() else ""
    entrants = {p: 0 for p in pages}
    erreurs, avertissements, perimees = [], [], []
    modifies_non_commites = set((git("status", "--porcelain") or "").replace("?? ", "   ").split())

    for p in pages:
        texte = p.read_text(encoding="utf-8")
        rel = relatives[p]
        for cible in LIEN.findall(texte):
            chemin = (p.parent / cible).resolve()
            if not chemin.exists():
                erreurs.append(f"lien cassé : {rel} → {cible}")
            elif chemin in entrants and chemin != p:
                entrants[chemin] += 1

        if rel in SANS_FRONTMATTER or rel.startswith("templates/"):
            continue
        fm = frontmatter(texte)
        if fm is None:
            avertissements.append(f"frontmatter absent : {rel}")
            continue
        if fm.get("type") in ("index", "log"):
            continue
        manquants = [c for c in CHAMPS if not fm.get(c)]
        if manquants:
            avertissements.append(f"frontmatter incomplet : {rel} (manque {', '.join(manquants)})")
        liste = sources(fm.get("sources"))
        for s in liste:
            if not (RACINE_DEPOT / s.rstrip("/")).exists():
                erreurs.append(f"source introuvable : {rel} → {s}")
        commit = fm.get("commit")
        if commit and liste:
            existants = [s for s in liste if (RACINE_DEPOT / s.rstrip("/")).exists()]
            changes = git("log", "--format=%h %ad %s", "--date=short", f"{commit}..HEAD", "--", *existants)
            if changes is None:
                avertissements.append(f"commit inconnu de git : {rel} ({commit})")
            elif changes:
                perimees.append(f"{rel} — commits depuis {commit} :\n      " + changes.replace("\n", "\n      "))
            locaux = [s for s in existants if any(m.startswith(s.rstrip("/")) for m in modifies_non_commites)]
            if locaux:
                perimees.append(f"{rel} — modifications non commitées dans : {', '.join(locaux)}")

    for p in pages:
        rel = relatives[p]
        if rel in HORS_ORPHELINS:
            continue
        if rel not in index:
            avertissements.append(f"absente de index.md : {rel}")
        if entrants[p] == 0:
            avertissements.append(f"orpheline (aucun lien entrant) : {rel}")

    print(f"Wiki : {len(pages)} pages\n")
    for titre, liste in (("ERREURS", erreurs), ("PAGES À REVÉRIFIER", perimees), ("AVERTISSEMENTS", avertissements)):
        print(f"## {titre} ({len(liste)})")
        for ligne in liste:
            print(f"  - {ligne}")
        print()
    return 1 if erreurs else 0


if __name__ == "__main__":
    sys.exit(main())
