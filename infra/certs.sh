#!/usr/bin/env bash
# Génère les certificats HTTPS locaux (mkcert) : la caméra du navigateur est bloquée en HTTP hors localhost.
# Usage : ./infra/certs.sh [IP du poste sur le réseau local]
set -euo pipefail
cd "$(dirname "$0")"
IP="${1:-$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo 127.0.0.1)}"
mkcert -install
mkcert -cert-file certs/flex-checking.pem -key-file certs/flex-checking-key.pem \
  flex-checking.localhost localhost 127.0.0.1 "$IP"
echo "Certificats créés pour flex-checking.localhost, localhost et $IP."
echo "Sur un téléphone : installez l'autorité mkcert ($(mkcert -CAROOT)/rootCA.pem) puis ouvrez https://$IP:8443"
