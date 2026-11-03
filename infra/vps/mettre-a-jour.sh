#!/usr/bin/env bash
# Met l'application à jour avec la dernière version publiée sur GitHub. JAMAIS le jour d'une cérémonie.
#   infra/vps/mettre-a-jour.sh
# Sauvegarde → récupération du code → site reconstruit → serveur reconstruit (correctifs des images
# compris) → redémarrage (les migrations passent avant Django) → vérification.
set -euo pipefail
source "$(dirname "$0")/commun.sh"
cd "$RACINE"

[ "$(id -u)" -ne 0 ] || arreter "Lancez ce script SANS sudo : infra/vps/mettre-a-jour.sh"
verifier_docker

etape "Sauvegarde avant mise à jour"
if sudo -n test -s /root/.flex-sauvegarde-phrase; then
  sudo -n infra/vps/sauvegarde.sh
else
  jaune "⚠ Sauvegardes non activées (sudo infra/vps/activer-sauvegardes.sh) : mise à jour sans sauvegarde."
  read -r -p "Continuer quand même ? (o/N) " OK
  [ "$OK" = "o" ] || arreter "Annulé."
fi

etape "Récupération de la nouvelle version"
AVANT="$(git rev-parse --short HEAD)"
git pull --ff-only || arreter "git pull refusé : un fichier a été modifié sur le serveur. Ne forcez rien, prévenez le développeur (git status)."
APRES="$(git rev-parse --short HEAD)"
if [ "$AVANT" = "$APRES" ]; then vert "✓ Déjà à jour ($APRES) : reconstruction quand même (correctifs de sécurité)"; else vert "✓ $AVANT → $APRES"; fi

construire_site

etape "Reconstruction et redémarrage"
docker compose build --pull
docker compose up -d
attendre_application
docker compose ps -a
docker image prune -f >/dev/null
vert "✓ Mise à jour terminée (version $APRES)"
