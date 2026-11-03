#!/usr/bin/env bash
# Installe et démarre Flex'Checking sur le VPS (sans sudo), depuis le dossier du code :
#   infra/vps/installer.sh
# 1. pose 4 questions et écrit le fichier .env (secrets générés au hasard, jamais affichés) ;
# 2. construit le site, démarre la pile docker-compose.prod.yml, attend qu'elle réponde ;
# 3. propose de créer le premier compte super admin.
# Relançable : un .env existant est conservé (pour le refaire, supprimez-le AVANT le premier démarrage
# seulement : les mots de passe MySQL sont fixés au premier démarrage).
set -euo pipefail
source "$(dirname "$0")/commun.sh"
cd "$RACINE"

[ "$(id -u)" -ne 0 ] || arreter "Lancez ce script SANS sudo : infra/vps/installer.sh"
verifier_docker

demander() { # demander <question> <variable> [défaut]
  local reponse
  while true; do
    if [ -n "${3:-}" ]; then read -r -p "$1 [$3] : " reponse; else read -r -p "$1 : " reponse; fi
    reponse="${reponse:-${3:-}}"
    [ -n "$reponse" ] && break
    jaune "  Réponse obligatoire."
  done
  printf -v "$2" '%s' "$reponse"
}

if [ -f .env ]; then
  etape "Fichier .env déjà présent : conservé"
else
  etape "Configuration (4 questions)"
  echo "Les réponses sont enregistrées dans le fichier .env du serveur, lisible par vous seul."
  echo
  demander "1. Adresse du site, sans https:// (ex. emargement.mde.ci)" DOMAINE
  DOMAINE="${DOMAINE#https://}"
  DOMAINE="${DOMAINE#http://}"
  DOMAINE="${DOMAINE%%/*}"
  demander "2. Adresse email d'envoi (ex. evenements@mde.ci)" EMAIL_ENVOI
  demander "3. Serveur d'envoi SMTP (ex. mail.infomaniak.com)" SMTP
  while true; do
    read -r -s -p "4. Mot de passe du compte email d'envoi (ne s'affiche pas) : " MDP_SMTP
    echo
    [ -n "$MDP_SMTP" ] || {
      jaune "  Réponse obligatoire."
      continue
    }
    case "$MDP_SMTP" in *"'"*) jaune "  Ce script n'accepte pas l'apostrophe ' dans le mot de passe. Changez-le chez votre fournisseur ou écrivez le .env à la main (voir le guide complet)." ;; *) break ;; esac
  done

  umask 077
  cat >.env <<EOF
# Production Flex'Checking (VPS Lite) — écrit par infra/vps/installer.sh le $(date +%F)
# NE JAMAIS partager ce fichier. Les mots de passe MySQL ne doivent plus changer après le premier démarrage.
COMPOSE_FILE=docker-compose.prod.yml
DOMAINE=$DOMAINE
APP_PUBLIC_URL=https://$DOMAINE
DJANGO_ALLOWED_HOSTS=$DOMAINE
CSRF_TRUSTED_ORIGINS=https://$DOMAINE
MYSQL_DATABASE=flex
MYSQL_USER=flex
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=$SMTP
EMAIL_PORT=587
EMAIL_USE_TLS=1
EMAIL_HOST_USER=$EMAIL_ENVOI
EMAIL_HOST_PASSWORD='$MDP_SMTP'
DEFAULT_FROM_EMAIL=$EMAIL_ENVOI
# dimensionnement VPS Lite 2 vCPU / 4 Go
MYSQL_INNODB_BUFFER=512M
REDIS_MAXMEMORY=128mb
WEB_CONCURRENCY=3
DB_CONCURRENCE=24
CELERY_CONCURRENCY=2
# secrets générés au hasard
DJANGO_SECRET_KEY=$(openssl rand -hex 32)
MYSQL_PASSWORD=$(openssl rand -hex 24)
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 24)
EOF
  chmod 600 .env
  unset MDP_SMTP
  vert "✓ Fichier .env écrit (secrets générés, non affichés)"
fi

for v in DOMAINE DJANGO_SECRET_KEY MYSQL_PASSWORD MYSQL_ROOT_PASSWORD EMAIL_HOST DEFAULT_FROM_EMAIL; do
  [ -n "$(valeur_env "$v")" ] || arreter "La variable $v manque dans .env."
done
[ "$(valeur_env COMPOSE_FILE)" = "docker-compose.prod.yml" ] || arreter "COMPOSE_FILE=docker-compose.prod.yml manque dans .env."

construire_site

etape "Démarrage de l'application (5 à 15 minutes la première fois)"
docker compose up -d --build
attendre_application
docker compose ps -a
verifier_certificat

etape "Compte super admin"
EXISTE="$(docker compose exec -T django python manage.py shell -c \
  "from apps.comptes.models import Admin, Role; print(Admin.objects.filter(role=Role.SUPER_ADMIN).exists())" 2>/dev/null | tail -n 1)"
if [ "$EXISTE" = "True" ]; then
  vert "✓ Un super admin existe déjà"
else
  echo "Création du premier super admin : email, nom complet, puis mot de passe (10 caractères minimum, ne s'affiche pas)."
  docker compose exec django python manage.py createsuperuser
fi

echo
vert "✓ Installation terminée : https://$(valeur_env DOMAINE)/super/connexion"
jaune "Étape suivante : activer les sauvegardes → sudo infra/vps/activer-sauvegardes.sh"
