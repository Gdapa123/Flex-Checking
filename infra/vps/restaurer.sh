#!/usr/bin/env bash
# Restaure une sauvegarde chiffrée. ⚠ Remplace TOUTES les données actuelles.
#   sudo infra/vps/restaurer.sh sauvegardes/flex-AAAA-MM-JJ-HHMMSS.sql.gz.gpg
# Une sauvegarde de l'état actuel est faite juste avant.
set -euo pipefail
source "$(dirname "$0")/commun.sh"
PHRASE=/root/.flex-sauvegarde-phrase

[ "$(id -u)" -eq 0 ] || arreter "Lancez ce script avec sudo."
[ $# -eq 1 ] || arreter "Indiquez le fichier : sudo infra/vps/restaurer.sh sauvegardes/flex-….sql.gz.gpg (liste : ls $RACINE/sauvegardes)"
FICHIER="$(readlink -f "$1")"
[ -f "$FICHIER" ] || arreter "Fichier introuvable : $1"
[ -s "$PHRASE" ] || arreter "Phrase absente : sudo nano $PHRASE, collez la phrase conservée, puis sudo chmod 600 $PHRASE"
gpg --decrypt --batch --pinentry-mode loopback --passphrase-file "$PHRASE" "$FICHIER" 2>/dev/null | gunzip -t 2>/dev/null ||
  arreter "Impossible de déchiffrer ce fichier : phrase incorrecte ou fichier abîmé. Rien n'a été modifié."

jaune "⚠ Les données actuelles vont être REMPLACÉES par celles de $(basename "$FICHIER")."
read -r -p "Tapez RESTAURER pour confirmer : " OK
[ "$OK" = "RESTAURER" ] || arreter "Annulé, rien n'a été modifié."

# copie de travail : la sauvegarde de sécurité ci-dessous ne peut pas toucher au fichier à restaurer
COPIE="$(mktemp)"
trap 'rm -f "$COPIE"' EXIT
cp "$FICHIER" "$COPIE"

etape "Sauvegarde de l'état actuel"
"$RACINE/infra/vps/sauvegarde.sh"
etape "Restauration"
cd "$RACINE"
gpg --decrypt --batch --pinentry-mode loopback --passphrase-file "$PHRASE" "$COPIE" | gunzip |
  docker compose exec -T mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
docker compose restart django celery celery-beat >/dev/null 2>&1
vert "✓ Restauration terminée"
