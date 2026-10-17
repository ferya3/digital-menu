#!/usr/bin/env bash
# گواهیِ رایگانِ HTTPS برای یک زیردامنه/دامنهٔ اختصاصی (خودکار توسطِ برنامه بعد از ثبت‌نامِ هر مجموعه).
#   دستی:  sudo bash tenant-cert.sh roya.artavilstar.com
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="$(echo "${1:-}" | tr 'A-Z' 'a-z')"
[[ "$HOST" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] || { echo "نامِ میزبان نامعتبر است: $HOST"; exit 2; }
[ -f "/etc/nginx/tenant-certs/$HOST/fullchain.pem" ] && exit 0
command -v certbot >/dev/null 2>&1 || { echo "certbot نصب نیست (set-saas.sh را اجرا کنید)"; exit 3; }
EMAIL="$(sed -n 's/^CERT_EMAIL=//p' "$APP_DIR/.env.production.local" 2>/dev/null | head -1)"
LOG=/var/log/cafe-certs.log
mkdir -p /var/www/certbot
echo "[$(date -Is)] $HOST" >> "$LOG"
if [ -n "$EMAIL" ]; then ACC=(-m "$EMAIL"); else ACC=(--register-unsafely-without-email); fi
certbot certonly --webroot -w /var/www/certbot -d "$HOST" --cert-name "$HOST" \
  --non-interactive --agree-tos "${ACC[@]}" --keep-until-expiring >> "$LOG" 2>&1
RENEWED_LINEAGE="/etc/letsencrypt/live/$HOST" RENEWED_DOMAINS="$HOST" bash "$APP_DIR/cert-hook.sh"
