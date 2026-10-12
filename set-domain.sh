#!/usr/bin/env bash
# اتصالِ دامنه + گواهی رایگانِ SSL (HTTPS) به سایتِ نصب‌شده.
#   اجرا:  sudo DOMAIN=artavilstar.com bash set-domain.sh
#   (اختیاری) EMAIL=you@mail.com  برای یادآوریِ تمدیدِ گواهی
#
# قبل از اجرا: در پنلِ دامنه رکوردِ A برای artavilstar.com و www را روی IP همین سرور بگذارید.
# QRهای قدیمیِ چاپ‌شده با IP خراب نمی‌شوند: هر درخواست به IP با همان مسیر (و ?table=) به دامنه هدایت می‌شود.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
say(){ printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die(){ printf '\n\033[1;31m✖ %s\033[0m\n' "$*"; exit 1; }

[ "$(id -u)" -eq 0 ] || die "با sudo اجرا کنید"
DOMAIN="${DOMAIN:-}"; DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%%/*}"; DOMAIN="${DOMAIN#www.}"
[ -n "$DOMAIN" ] || die "دامنه را بدهید:  sudo DOMAIN=artavilstar.com bash set-domain.sh"
APP_PORT="${APP_PORT:-3000}"
NGX=/etc/nginx/sites-available/cafe
WEBROOT=/var/www/certbot

say "بررسی DNS"
command -v dig >/dev/null 2>&1 || apt-get install -y -qq dnsutils >/dev/null 2>&1 || true
MYIP="$(curl -4 -s --max-time 6 https://api.ipify.org || curl -4 -s --max-time 6 https://ifconfig.me || true)"
resolve(){ (dig +short A "$1" 2>/dev/null || getent ahostsv4 "$1" | awk '{print $1}') | grep -E '^[0-9.]+$' | head -1; }
IP_ROOT="$(resolve "$DOMAIN" || true)"
IP_WWW="$(resolve "www.$DOMAIN" || true)"
echo "  IP این سرور:        ${MYIP:-نامشخص}"
echo "  $DOMAIN  →  ${IP_ROOT:-(تنظیم نشده)}"
echo "  www.$DOMAIN  →  ${IP_WWW:-(تنظیم نشده)}"
if [ -z "$IP_ROOT" ] || { [ -n "$MYIP" ] && [ "$IP_ROOT" != "$MYIP" ]; }; then
  die "رکورد A دامنهٔ $DOMAIN هنوز به IP این سرور (${MYIP:-?}) اشاره نمی‌کند. در پنلِ دامنه تنظیمش کنید، چند دقیقه صبر کنید و دوباره اجرا کنید."
fi
NAMES=("$DOMAIN"); SERVER_NAMES="$DOMAIN"
if [ -n "$IP_WWW" ] && { [ -z "$MYIP" ] || [ "$IP_WWW" = "$MYIP" ]; }; then NAMES+=("www.$DOMAIN"); SERVER_NAMES="$DOMAIN www.$DOMAIN"; fi

say "نصب certbot"
command -v certbot >/dev/null 2>&1 || { apt-get update -qq; DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot; }
mkdir -p "$WEBROOT"

# اگر IPv6 روی سرور خاموش باشد، listen [::] باعثِ خطای Nginx می‌شود
if [ -f /proc/net/if_inet6 ]; then V6=1; else V6=""; fi
v6(){ if [ -n "$V6" ]; then echo "    listen [::]:$1;"; fi; }

proxy_block(){ cat <<EOF
    client_max_body_size 120m;
    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
    }
EOF
}

# مرحلهٔ ۱: HTTP با مسیرِ تأییدِ Let's Encrypt (سایت در این مدت هم کار می‌کند)
[ -f "$NGX" ] && cp "$NGX" "$NGX.bak.$(date +%s)"
CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [ ! -f "$CERT" ]; then
  say "پیکربندی موقت Nginx برای دریافت گواهی"
  { cat <<EOF
server {
    listen 80 default_server;
$(v6 "80 default_server")
    server_name _;
    location /.well-known/acme-challenge/ { root $WEBROOT; }
EOF
    proxy_block; echo "}"; } >"$NGX"
  ln -sf "$NGX" /etc/nginx/sites-enabled/cafe; rm -f /etc/nginx/sites-enabled/default
  if { nginx -t 2>&1 || true; } | grep -q "Address family not supported"; then sed -i '/listen \[::\]/d' "$NGX"; fi
  nginx -t && systemctl reload nginx

  say "دریافت گواهی SSL رایگان از Let's Encrypt"
  ARGS=(certonly --webroot -w "$WEBROOT" --non-interactive --agree-tos --cert-name "$DOMAIN")
  for n in "${NAMES[@]}"; do ARGS+=(-d "$n"); done
  if [ -n "${EMAIL:-}" ]; then ARGS+=(-m "$EMAIL"); else ARGS+=(--register-unsafely-without-email); fi
  certbot "${ARGS[@]}" || die "گواهی گرفته نشد. پورت ۸۰ سرور باید از اینترنت باز باشد و DNS درست باشد. (سایت روی HTTP مثل قبل کار می‌کند)"
fi

# مرحلهٔ ۲: پیکربندیِ نهایی — HTTPS روی دامنه؛ IP و http و www به https://دامنه هدایت می‌شوند
say "پیکربندی نهایی Nginx (HTTPS)"
{ cat <<EOF
# HTTP (دامنه، www و IP) → https://$DOMAIN  (با حفظ مسیر و ?table=)
server {
    listen 80 default_server;
$(v6 "80 default_server")
    server_name _;
    location /.well-known/acme-challenge/ { root $WEBROOT; }
    location / { return 301 https://$DOMAIN\$request_uri; }
}

# HTTPS
server {
    listen 443 ssl default_server;
$(v6 "443 ssl default_server")
    http2 on;
    server_name $SERVER_NAMES;
    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    add_header Strict-Transport-Security "max-age=31536000" always;

    # www یا IP روی https → دامنهٔ اصلی
    if (\$host != "$DOMAIN") { return 301 https://$DOMAIN\$request_uri; }

    gzip on;
    gzip_proxied any;
    gzip_types text/css application/javascript application/json image/svg+xml;
EOF
  proxy_block; echo "}"; } >"$NGX"
ln -sf "$NGX" /etc/nginx/sites-enabled/cafe; rm -f /etc/nginx/sites-enabled/default
# nginxهای قدیمی‌تر (مثل ۱.۲۴ روی اوبونتو ۲۴) «http2 on» را نمی‌شناسند
ngx_test(){ nginx -t 2>&1 || true; }   # (خروجی را جدا می‌گیریم؛ با pipefail لوله‌کشی مستقیم غلط جواب می‌دهد)
if ngx_test | grep -q 'unknown directive "http2"'; then
  sed -i 's/^    http2 on;$//; s/listen 443 ssl default_server;/listen 443 ssl http2 default_server;/; s/listen \[::\]:443 ssl default_server;/listen [::]:443 ssl http2 default_server;/' "$NGX"
fi
# اگر IPv6 روی سرور واقعاً کار نمی‌کند
if ngx_test | grep -q "Address family not supported"; then sed -i '/listen \[::\]/d' "$NGX"; fi
nginx -t
systemctl reload nginx

# تمدیدِ خودکار: certbot تایمرِ خودش را دارد؛ بعد از تمدید Nginx را دوباره بارگذاری کن
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nsystemctl reload nginx\n' >/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
systemctl enable --now certbot.timer >/dev/null 2>&1 || true

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 'Nginx Full' >/dev/null || true
fi

sleep 1
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$DOMAIN/" || true)"
say "تمام شد ✅  (پاسخ https://$DOMAIN : ${CODE:-?})"
echo "  منوی مشتری:   https://$DOMAIN/?table=1"
echo "  پنل کارکنان:  https://$DOMAIN/staff"
echo "  QRهای قدیمی (با IP) هم به همین دامنه هدایت می‌شوند؛ برای QRهای تازه از پنل ← کدهای QR دوباره چاپ بگیرید."
