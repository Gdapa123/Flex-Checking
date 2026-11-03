#!/usr/bin/env bash
# Active la sauvegarde chiffrée chaque nuit à 2 h 30. À lancer une fois, avec sudo :
#   sudo infra/vps/activer-sauvegardes.sh
# Crée la phrase de chiffrement (affichée UNE seule fois : à recopier dans le coffre de MDE),
# programme la sauvegarde et en fait une première.
set -euo pipefail
source "$(dirname "$0")/commun.sh"
PHRASE=/root/.flex-sauvegarde-phrase

[ "$(id -u)" -eq 0 ] || arreter "Lancez ce script avec sudo : sudo infra/vps/activer-sauvegardes.sh"

etape "Phrase de chiffrement"
if [ -s "$PHRASE" ]; then
  vert "✓ Déjà créée (non réaffichée). Pour la relire : sudo cat $PHRASE"
else
  (umask 077 && openssl rand -base64 32 >"$PHRASE")
  echo
  jaune "════════════════════════════════════════════════════════════════════"
  jaune "  PHRASE DE CHIFFREMENT — recopiez-la MAINTENANT dans le coffre de MDE"
  jaune "  (sans elle, aucune sauvegarde ne pourra jamais être relue) :"
  echo
  echo "      $(cat "$PHRASE")"
  echo
  jaune "════════════════════════════════════════════════════════════════════"
  read -r -p "Appuyez sur Entrée une fois la phrase recopiée… " _
  clear 2>/dev/null || true
fi

etape "Programmation chaque nuit à 2 h 30"
CIBLE=/usr/local/bin/flex-sauvegarde.sh
ln -sf "$RACINE/infra/vps/sauvegarde.sh" "$CIBLE"
LIGNE="30 2 * * * $CIBLE >>/var/log/flex-sauvegarde.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'flex-sauvegarde' || true; echo "$LIGNE" ) | crontab -
vert "✓ Programmée ($LIGNE)"

etape "Première sauvegarde"
"$CIBLE"
