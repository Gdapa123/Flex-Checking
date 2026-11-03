#!/usr/bin/env bash
# Prépare un VPS Ubuntu 24.04 neuf pour Flex'Checking. À lancer UNE fois, avec sudo :
#   sudo infra/vps/preparer-serveur.sh
# Effet : système à jour, mises à jour de sécurité automatiques, fail2ban, fuseau Africa/Abidjan,
# 2 Go de swap, Docker, connexion SSH par clé uniquement (si une clé est déjà installée).
# Peut être relancé sans risque : chaque étape déjà faite est sautée.
set -euo pipefail
source "$(dirname "$0")/commun.sh"

[ "$(id -u)" -eq 0 ] || arreter "Lancez ce script avec sudo : sudo infra/vps/preparer-serveur.sh"
UTILISATEUR="${SUDO_USER:-ubuntu}"
export DEBIAN_FRONTEND=noninteractive

etape "1/5 Mise à jour du système (quelques minutes)"
apt-get update -q
apt-get -y -q -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold full-upgrade
apt-get -y -q install unattended-upgrades fail2ban git gnupg curl
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl enable --now fail2ban >/dev/null
timedatectl set-timezone Africa/Abidjan
vert "✓ Système à jour, correctifs de sécurité automatiques, fail2ban actif"

etape "2/5 Mémoire d'échange (swap)"
if swapon --show | grep -q .; then
  vert "✓ Swap déjà présent"
else
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
  vert "✓ 2 Go de swap ajoutés"
fi

etape "3/5 Docker"
if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
  vert "✓ Docker déjà installé"
else
  curl -fsSL https://get.docker.com | sh
  vert "✓ Docker installé"
fi
usermod -aG docker "$UTILISATEUR"

etape "4/5 Connexion SSH par clé uniquement"
CLES="$(getent passwd "$UTILISATEUR" | cut -d: -f6)/.ssh/authorized_keys"
if [ -s "$CLES" ]; then
  printf 'PasswordAuthentication no\nPermitRootLogin no\n' >/etc/ssh/sshd_config.d/00-durcissement.conf
  if sshd -t; then
    systemctl restart ssh
    vert "✓ Mots de passe et connexion root interdits par SSH"
  else
    rm -f /etc/ssh/sshd_config.d/00-durcissement.conf
    jaune "⚠ Réglage SSH refusé par le serveur : rien n'a été changé."
  fi
else
  jaune "⚠ Aucune clé SSH trouvée pour $UTILISATEUR : connexion par mot de passe laissée active (rien changé)."
fi

etape "5/5 Terminé"
vert "✓ Serveur prêt."
echo
jaune "À FAIRE MAINTENANT :"
echo "  1. Ouvrez une NOUVELLE fenêtre du Terminal et vérifiez que « ssh $UTILISATEUR@<IP_DU_VPS> » fonctionne."
echo "  2. Dans cette fenêtre-ci, tapez « exit » puis reconnectez-vous (pour pouvoir utiliser Docker)."
if [ -f /var/run/reboot-required ]; then
  jaune "  3. Le système demande un redémarrage : tapez « sudo reboot », attendez 1 minute, reconnectez-vous."
fi
