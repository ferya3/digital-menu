#!/usr/bin/env bash
# Free HTTPS certificate for a subdomain/custom domain (run automatically by the app after each venue signs up).
#   Manually:  sudo bash tenant-cert.sh bluebottle.example.com
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="$(echo "${1:-}" | tr 'A-Z' 'a-z')"
[[ "$HOST" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] || { echo "Invalid host name: $HOST"; exit 2; }
[ -f "/etc/nginx/tenant-certs/$HOST/fullchain.pem" ] && exit 0
command -v certbot >/dev/null 2>&1 || { echo "certbot isn't installed (run set-saas.sh)"; exit 3; }
EMAIL="$(sed -n 's/^CERT_EMAIL=//p' "$APP_DIR/.env.production.local" 2>/dev/null | head -1)"
LOG=/var/log/cafe-certs.log
mkdir -p /var/www/certbot
echo "[$(date -Is)] $HOST" >> "$LOG"
if [ -n "$EMAIL" ]; then ACC=(-m "$EMAIL"); else ACC=(--register-unsafely-without-email); fi
certbot certonly --webroot -w /var/www/certbot -d "$HOST" --cert-name "$HOST" \
  --non-interactive --agree-tos "${ACC[@]}" --keep-until-expiring >> "$LOG" 2>&1
RENEWED_LINEAGE="/etc/letsencrypt/live/$HOST" RENEWED_DOMAINS="$HOST" bash "$APP_DIR/cert-hook.sh"
