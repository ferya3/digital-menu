#!/usr/bin/env bash
# ============================================================================
#  نصب «منوی دیجیتال کافه» روی سرور اوبونتو (سرویسِ دائمی + Nginx + SSL)
#  از داخلِ پوشهٔ همین ریپو اجرا شود.
#
#  متغیرها (اختیاری):
#    DOMAIN           دامنه برای Nginx + SSL   (مثلاً artavilstar.com)
#    EMAIL            ایمیل برای Let's Encrypt
#    PORT             پورت داخلی Node          (پیش‌فرض 3000)
#    ADMIN_PASSWORD   رمز ورود مدیر            (پیش‌فرض cafe1234 — حتماً عوض کن)
#    SERVICE          نام سرویس systemd        (پیش‌فرض cafe)
#
#  نمونه:
#    sudo DOMAIN=artavilstar.com EMAIL=you@example.com ADMIN_PASSWORD='Str0ng!' bash install.sh
# ============================================================================
set -euo pipefail
PORT="${PORT:-3000}"; SERVICE="${SERVICE:-cafe}"; ADMIN_PASSWORD="${ADMIN_PASSWORD:-cafe1234}"
DOMAIN="${DOMAIN:-}"; EMAIL="${EMAIL:-}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; RUN_USER="${SUDO_USER:-root}"
say(){ printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
[ "$(id -u)" -eq 0 ] || { echo "با sudo/root اجرا کن."; exit 1; }

# 1) Node.js 20
NEED=1
if command -v node >/dev/null 2>&1; then M="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null||echo 0)"; [ "${M:-0}" -ge 18 ] && NEED=0; fi
if [ "$NEED" -eq 1 ]; then say "نصب Node.js 20"; curl -fsSL https://deb.nodesource.com/setup_20.x | bash -; apt-get install -y nodejs; fi
say "Node $(node -v)"

# 2) وابستگی‌ها
say "نصب وابستگی‌ها"; cd "$APP_DIR"; npm install --omit=dev --no-audit --no-fund
chown -R "$RUN_USER":"$RUN_USER" "$APP_DIR" 2>/dev/null || true

# 3) سرویس systemd
say "ساخت سرویس systemd: $SERVICE"
cat >/etc/systemd/system/"$SERVICE".service <<UNIT
[Unit]
Description=Cafe Digital Menu
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=$(command -v node) server/index.js
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=NO_OPEN=1
Environment=ADMIN_PASSWORD=$ADMIN_PASSWORD
Restart=always
RestartSec=3
User=$RUN_USER

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload; systemctl enable "$SERVICE" >/dev/null 2>&1 || true; systemctl restart "$SERVICE"
sleep 1; systemctl --no-pager --lines=0 status "$SERVICE" || true

# 4) Nginx + SSL
if [ -n "$DOMAIN" ]; then
  say "Nginx برای $DOMAIN"; apt-get install -y nginx >/dev/null
  cat >/etc/nginx/sites-available/"$SERVICE" <<NGINX
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 12m;
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
  ln -sf /etc/nginx/sites-available/"$SERVICE" /etc/nginx/sites-enabled/"$SERVICE"
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl restart nginx
  if [ -n "$EMAIL" ]; then
    say "SSL برای $DOMAIN"; apt-get install -y certbot python3-certbot-nginx >/dev/null
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect || \
      echo "⚠️  certbot نشد؛ DNSِ $DOMAIN باید به IP این سرور باشد و پورت‌های 80/443 باز."
  fi
fi

say "تمام شد ✅"
PROTO="http"; [ -n "$DOMAIN" ] && [ -n "$EMAIL" ] && PROTO="https"
HOST="${DOMAIN:-<IP-سرور>:$PORT}"
echo "  مشتری:  $PROTO://$HOST/?table=1"
echo "  مدیر:   $PROTO://$HOST/login   (رمز: $ADMIN_PASSWORD)"
[ "$ADMIN_PASSWORD" = "cafe1234" ] && echo "  ⚠️  رمز پیش‌فرض cafe1234 است؛ با ADMIN_PASSWORD عوضش کن."
