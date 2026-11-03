# Fonctions partagées par les scripts du VPS (chargé par `source`, ne pas lancer seul).
# Dossier de l'application : la racine du dépôt (deux niveaux au-dessus de ce fichier).

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

vert() { printf '\033[32m%s\033[0m\n' "$*"; }
jaune() { printf '\033[33m%s\033[0m\n' "$*"; }
rouge() { printf '\033[31m%s\033[0m\n' "$*" >&2; }
etape() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
arreter() {
  rouge "✗ $*"
  exit 1
}

# Valeur d'une variable du fichier .env (sans l'afficher ailleurs)
valeur_env() {
  sed -n "s/^$1=//p" "$RACINE/.env" | tail -n 1 | sed "s/^'\(.*\)'$/\1/"
}

verifier_docker() {
  command -v docker >/dev/null || arreter "Docker n'est pas installé : lancez d'abord « sudo infra/vps/preparer-serveur.sh »."
  docker info >/dev/null 2>&1 || arreter "Docker n'est pas utilisable sans sudo. Déconnectez-vous (exit), reconnectez-vous, puis relancez."
}

construire_site() {
  etape "Construction du site (2 à 5 minutes)"
  docker run --rm --pull always -v "$RACINE/frontend:/app" -w /app node:24-alpine \
    sh -c "npm ci --no-audit --no-fund --loglevel=error && npm run build" ||
    arreter "Construction du site impossible. Si « Killed » : mémoire insuffisante (vérifiez le swap avec « free -h »)."
  [ -f "$RACINE/frontend/dist/index.html" ] || arreter "Le site construit est introuvable (frontend/dist)."
  vert "✓ Site construit"
}

# Attend que l'application réponde en HTTPS (5 minutes au plus).
attendre_application() {
  local domaine
  domaine="$(valeur_env DOMAINE)"
  etape "Attente du démarrage de l'application"
  for _ in $(seq 1 60); do
    if curl -fsk --max-time 5 --resolve "$domaine:443:127.0.0.1" "https://$domaine/api/sante/" >/dev/null 2>&1; then
      vert "✓ L'application répond"
      return 0
    fi
    sleep 5
  done
  docker compose ps -a
  arreter "L'application ne répond pas après 5 minutes. Lisez le journal : docker compose logs --tail=100 django"
}

verifier_certificat() {
  local domaine
  domaine="$(valeur_env DOMAINE)"
  if curl -fs --max-time 10 "https://$domaine/api/sante/" >/dev/null 2>&1; then
    vert "✓ HTTPS valide : https://$domaine"
  else
    jaune "⚠ Le certificat HTTPS n'est pas encore valide pour https://$domaine."
    jaune "  Vérifiez le DNS (l'adresse doit pointer vers ce serveur) et les ports 80/443, puis attendez quelques minutes."
    jaune "  Journal : docker compose logs --tail=50 proxy"
  fi
}
