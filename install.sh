#!/usr/bin/env bash
# ============================================================================
#  نصب و راه‌اندازی «منوی دیجیتال کافه» روی سرور اوبونتو (به‌صورت سرویسِ دائمی)
#  این اسکریپت از داخلِ پوشهٔ همین ریپو اجرا می‌شود.
#
#  متغیرها (اختیاری):
#    DOMAIN           دامنه برای Nginx + SSL   (مثلاً artavilstar.com)
#    EMAIL            ایمیل برای Let's Encrypt (مثلاً you@example.com)
#    PORT             پورت داخلی Node          (پیش‌فرض 3000)
#    ADMIN_PASSWORD   رمز ورود پنل کارکنان     (پیش‌فرض cafe1234 — حتماً عوض کن)
#    SERVICE          نام سرویس systemd        (پیش‌فرض cafe)
#
#  نمونه:
#    sudo DOMAIN=artavilstar.com EMAIL=you@example.com ADMIN_PASSWORD='Str0ng!' bash install.sh
# ============================================================================
set -euo pipefail

PORT="${PORT:-3000}"
SERVICE="${SERVICE:-cafe}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-cafe1234}"
DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_USER="${SUDO_USER:-root}"

say(){ printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then echo "این اسکریپت را با sudo/root اجرا کن."; exit 1; fi

# ---------- 1) Node.js 20 (اگر نبود یا قدیمی بود) ----------
NEED_NODE=1
if command -v node >/dev/null 2>&1; then
  MAJ="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  [ "${MAJ:-0}" -ge 18 ] && NEED_NODE=0
fi
if [ "$NEED_NODE" -eq 1 ]; then
  say "نصب Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
say "Node $(node -v) / npm $(npm -v)"

# ---------- 2) نصب وابستگی‌ها و بیلدِ رابط React ----------
say "نصب وابستگی‌های بک‌اند"
cd "$APP_DIR"
npm install --omit=dev --no-audit --no-fund

say "نصب وابستگی‌ها و بیلد رابط React (web/)"
( cd web && npm install --no-audit --no-fund && npm run build )

# مالکیت فایل‌ها به کاربر اجراکننده (برای نوشتنِ data/ و public/images/)
chown -R "$RUN_USER":"$RUN_USER" "$APP_DIR" 2>/dev/null || true

# ---------- 3) سرویس systemd (اجرای دائمی + استارت بعد از ری‌بوت) ----------
say "ساخت سرویس systemd: $SERVICE"
cat >/etc/systemd/system/"$SERVICE".service <<UNIT
[Unit]
Description=Cafe Digital Menu (Node + React)
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

systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null 2>&1 || true
systemctl restart "$SERVICE"
sleep 1
systemctl --no-pager --lines=0 status "$SERVICE" || true

# ---------- 4) Nginx (reverse proxy) ----------
if [ -n "$DOMAIN" ]; then
  say "پیکربندی Nginx برای $DOMAIN"
  apt-get install -y nginx >/dev/null
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

  # ---------- 5) SSL با Let's Encrypt ----------
  if [ -n "$EMAIL" ]; then
    say "دریافت گواهی SSL برای $DOMAIN"
    apt-get install -y certbot python3-certbot-nginx >/dev/null
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect || \
      echo "⚠️  certbot موفق نشد؛ مطمئن شو رکوردِ DNSِ $DOMAIN به IP این سرور اشاره می‌کند و پورت‌های 80/443 باز است."
  else
    say "EMAIL داده نشد؛ SSL نصب نشد. فعلاً روی http://$DOMAIN در دسترس است."
  fi
fi

say "تمام شد ✅"
echo "  سرویس:    systemctl status $SERVICE   (لاگ: journalctl -u $SERVICE -f)"
if [ -n "$DOMAIN" ]; then
  PROTO="http"; [ -n "$EMAIL" ] && PROTO="https"
  echo "  مشتری:    $PROTO://$DOMAIN/?table=1"
  echo "  کارکنان:  $PROTO://$DOMAIN/staff   (رمز: $ADMIN_PASSWORD)"
else
  echo "  مشتری:    http://<IP-سرور>:$PORT/?table=1"
  echo "  کارکنان:  http://<IP-سرور>:$PORT/staff   (رمز: $ADMIN_PASSWORD)"
fi
[ "$ADMIN_PASSWORD" = "cafe1234" ] && echo "  ⚠️  رمز پیش‌فرض cafe1234 است؛ با متغیر ADMIN_PASSWORD عوضش کن."
