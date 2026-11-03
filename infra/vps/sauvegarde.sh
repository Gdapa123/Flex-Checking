#!/usr/bin/env bash
# Sauvegarde chiffrée (AES-256) de la base Flex'Checking. Lancée chaque nuit par root (cron posé par
# activer-sauvegardes.sh) ou à la main : sudo infra/vps/sauvegarde.sh
# Fichier produit : sauvegardes/flex-AAAA-MM-JJ-HHMMSS.sql.gz.gpg ; les fichiers de plus de 14 jours sont supprimés.
set -euo pipefail
source "$(dirname "$(readlink -f "$0")")/commun.sh"
PHRASE=/root/.flex-sauvegarde-phrase

[ "$(id -u)" -eq 0 ] || arreter "Lancez ce script avec sudo."
[ -s "$PHRASE" ] || arreter "Phrase de chiffrement absente : lancez d'abord sudo infra/vps/activer-sauvegardes.sh"
cd "$RACINE"
umask 077
mkdir -p sauvegardes
FICHIER="sauvegardes/flex-$(date +%F-%H%M%S).sql.gz.gpg"
docker compose exec -T mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --no-tablespaces "$MYSQL_DATABASE"' |
  gzip |
  gpg --symmetric --cipher-algo AES256 --batch --yes --pinentry-mode loopback --passphrase-file "$PHRASE" -o "$FICHIER"
# un fichier minuscule = sauvegarde vide (base injoignable) : on le signale
[ "$(stat -c %s "$FICHIER" 2>/dev/null || stat -f %z "$FICHIER")" -gt 1000 ] || arreter "Sauvegarde anormalement petite : $FICHIER"
chown "$(stat -c %U "$RACINE" 2>/dev/null || stat -f %Su "$RACINE")" sauvegardes "$FICHIER"
find sauvegardes -name 'flex-*.sql.gz.gpg' -mtime +14 -delete
vert "✓ Sauvegarde : $RACINE/$FICHIER ($(du -h "$FICHIER" | cut -f1))"
