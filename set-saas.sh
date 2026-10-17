#!/usr/bin/env bash
# ============================================================================
#  فعال‌سازیِ حالتِ «پلتفرمِ اشتراکی» (چند مجموعه، هر کدام روی زیردامنهٔ خودش)
#
#  sudo ROOT_DOMAIN=artavilstar.com EMAIL=you@mail.com PLATFORM_ADMIN_PASSWORD='رمز-قوی' \
#       LEGACY_TENANT=artavil bash set-saas.sh
#
#  ROOT_DOMAIN             دامنهٔ اصلی؛ سایتِ معرفی/ثبت‌نام روی آن و هر مجموعه روی <آدرس>.ROOT_DOMAIN
#  PLATFORM_ADMIN_PASSWORD رمزِ پنلِ مدیرِ کل (https://ROOT_DOMAIN/admin) — حداقل ۸ نویسه
#  EMAIL                   (اختیاری) ایمیل برای گواهی‌های Let's Encrypt
#  LEGACY_TENANT           (اختیاری) اگر این سرور قبلاً منوی یک کافه را داشته: داده‌اش با همین آدرس
#                          (مثلاً artavil.artavilstar.com) منتقل می‌شود و QRهای قدیمی خودکار هدایت می‌شوند
#
#  پیش‌نیاز در پنلِ دامنه: رکوردِ A برای ROOT_DOMAIN و www و «*» (همهٔ زیردامنه‌ها) روی IPِ همین سرور.
# ============================================================================
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"
say(){ printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die(){ printf '\n\033[1;31m✖ %s\033[0m\n' "$*"; exit 1; }
[ "$(id -u)" -eq 0 ] || die "با sudo اجرا کنید"

ENVF="$APP_DIR/.env.production.local"
cur(){ sed -n "s/^$1=//p" "$ENVF" 2>/dev/null | head -1; }
ROOT_DOMAIN="${ROOT_DOMAIN:-$(cur ROOT_DOMAIN)}"; ROOT_DOMAIN="${ROOT_DOMAIN#http://}"; ROOT_DOMAIN="${ROOT_DOMAIN#https://}"
ROOT_DOMAIN="$(echo "${ROOT_DOMAIN%%/*}" | tr 'A-Z' 'a-z')"; ROOT_DOMAIN="${ROOT_DOMAIN#www.}"
[ -n "$ROOT_DOMAIN" ] || die "دامنه را بدهید:  sudo ROOT_DOMAIN=example.com PLATFORM_ADMIN_PASSWORD='…' bash set-saas.sh"
PLATFORM_ADMIN_PASSWORD="${PLATFORM_ADMIN_PASSWORD:-$(cur PLATFORM_ADMIN_PASSWORD)}"
[ "${#PLATFORM_ADMIN_PASSWORD}" -ge 8 ] || die "PLATFORM_ADMIN_PASSWORD (رمزِ مدیرِ کل، حداقل ۸ نویسه) را بدهید"
EMAIL="${EMAIL:-$(cur CERT_EMAIL)}"
LEGACY_TENANT="$(echo "${LEGACY_TENANT:-$(cur LEGACY_TENANT)}" | tr 'A-Z' 'a-z')"
if [ -n "$LEGACY_TENANT" ] && ! [[ "$LEGACY_TENANT" =~ ^[a-z][a-z0-9-]{2,29}$ ]]; then die "LEGACY_TENANT نامعتبر است (حروفِ انگلیسیِ کوچک، عدد و -)"; fi
APP_PORT="${APP_PORT:-$(grep -ho 'proxy_pass http://127.0.0.1:[0-9]*' /etc/nginx/sites-available/cafe 2>/dev/null | head -1 | grep -o '[0-9]*$' || true)}"
APP_PORT="${APP_PORT:-3000}"

say "بررسی DNS"
command -v dig >/dev/null 2>&1 || apt-get install -y -qq dnsutils >/dev/null 2>&1 || true
MYIP="$(curl -4 -s --max-time 6 https://api.ipify.org || curl -4 -s --max-time 6 https://ifconfig.me || true)"
resolve(){ (dig +short A "$1" 2>/dev/null || getent ahostsv4 "$1" | awk '{print $1}') | grep -E '^[0-9.]+$' | head -1; }
PROBE="check-$RANDOM$RANDOM.$ROOT_DOMAIN"
IP_ROOT="$(resolve "$ROOT_DOMAIN" || true)"; IP_STAR="$(resolve "$PROBE" || true)"
echo "  IP این سرور:          ${MYIP:-نامشخص}"
echo "  $ROOT_DOMAIN  →  ${IP_ROOT:-(تنظیم نشده)}"
echo "  *.$ROOT_DOMAIN  →  ${IP_STAR:-(تنظیم نشده)}"
[ -n "$IP_ROOT" ] || die "رکورد A دامنهٔ $ROOT_DOMAIN تنظیم نشده است"
if [ -z "$IP_STAR" ] || { [ -n "$MYIP" ] && [ "$IP_STAR" != "$MYIP" ]; }; then
  echo "  ⚠️  رکوردِ A با نامِ «*» (همهٔ زیردامنه‌ها) هنوز به این سرور اشاره نمی‌کند؛ تا تنظیم نشود منوی مجموعه‌ها باز نمی‌شود."
fi

say "تنظیمِ برنامه (.env.production.local)"
touch "$ENVF"; chmod 600 "$ENVF"
setenv(){ local k="$1" v="$2"; grep -v "^$k=" "$ENVF" > "$ENVF.tmp" || true; [ -n "$v" ] && printf '%s=%s\n' "$k" "$v" >> "$ENVF.tmp"; mv "$ENVF.tmp" "$ENVF"; chmod 600 "$ENVF"; }
setenv ROOT_DOMAIN "$ROOT_DOMAIN"
setenv PLATFORM_ADMIN_PASSWORD "$PLATFORM_ADMIN_PASSWORD"
setenv LEGACY_TENANT "$LEGACY_TENANT"
setenv CERT_EMAIL "$EMAIL"
setenv AUTO_SSL 1

say "آماده‌سازیِ گواهی‌ها (Let's Encrypt)"
command -v certbot >/dev/null 2>&1 || { apt-get update -qq; DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot; }
mkdir -p /var/www/certbot /etc/letsencrypt/renewal-hooks/deploy
chmod +x "$APP_DIR/cert-hook.sh" "$APP_DIR/tenant-cert.sh"
# بعد از هر تمدیدِ خودکار، گواهیِ تازه برای Nginx کپی شود
ln -sf "$APP_DIR/cert-hook.sh" /etc/letsencrypt/renewal-hooks/deploy/cafe-tenant-certs.sh
# گواهی‌های موجود (مثلاً گواهیِ قبلیِ دامنهٔ اصلی از set-domain.sh)
for L in /etc/letsencrypt/live/*/; do
  [ -f "$L/fullchain.pem" ] || continue
  DOMS="$(openssl x509 -in "$L/fullchain.pem" -noout -ext subjectAltName 2>/dev/null | grep -o 'DNS:[^,]*' | sed 's/DNS://' | tr '\n' ' ')"
  RENEWED_LINEAGE="${L%/}" RENEWED_DOMAINS="${DOMS:-$(basename "$L")}" bash "$APP_DIR/cert-hook.sh" || true
done

say "پیکربندی Nginx (همهٔ زیردامنه‌ها)"
NGX=/etc/nginx/sites-available/cafe
[ -f "$NGX" ] && cp "$NGX" "$NGX.bak.$(date +%s)"
V6=""; [ -f /proc/net/if_inet6 ] && V6=1
proxy(){ cat <<EOF
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
EOF
}
{
cat <<EOF
# پلتفرمِ اشتراکی: یک بلوک برای همهٔ دامنه‌ها؛ برنامه از روی Host تشخیص می‌دهد کدام مجموعه است.
server {
    listen 80 default_server;
$( [ -n "$V6" ] && echo "    listen [::]:80 default_server;" )
    server_name _;
    location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; default_type text/plain; }
$(proxy)
        # اگر برای این میزبان گواهی هست → HTTPS
        if (-f /etc/nginx/tenant-certs/\$host/fullchain.pem) { return 301 https://\$host\$request_uri; }
    }
}
server {
    listen 443 ssl default_server;
$( [ -n "$V6" ] && echo "    listen [::]:443 ssl default_server;" )
    http2 on;
    server_name _;
    # گواهیِ هر میزبان بر اساسِ SNI (زیردامنه یا دامنهٔ اختصاصی)
    ssl_certificate     /etc/nginx/tenant-certs/\$ssl_server_name/fullchain.pem;
    ssl_certificate_key /etc/nginx/tenant-certs/\$ssl_server_name/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:CAFE:10m;
    ssl_session_timeout 1d;
    add_header Strict-Transport-Security "max-age=31536000" always;
    server_tokens off;
$(proxy)
    }
}
EOF
} > "$NGX"
rm -f /etc/nginx/sites-enabled/default
ln -sf "$NGX" /etc/nginx/sites-enabled/cafe
ngx_test(){ nginx -t 2>&1 || true; }
if ngx_test | grep -q 'unknown directive "http2"'; then
  sed -i 's/^    http2 on;$//; s/listen 443 ssl default_server;/listen 443 ssl http2 default_server;/; s/listen \[::\]:443 ssl default_server;/listen [::]:443 ssl http2 default_server;/' "$NGX"
fi
if ngx_test | grep -q "Address family not supported"; then sed -i '/listen \[::\]/d' "$NGX"; fi
nginx -t
systemctl reload nginx 2>/dev/null || nginx -s reload

say "راه‌اندازیِ دوبارهٔ برنامه"
pm2 reload cafe --update-env >/dev/null 2>&1 || (APP_PORT="$APP_PORT" pm2 start ecosystem.config.cjs)
pm2 save >/dev/null 2>&1 || true
sleep 4

say "گواهیِ HTTPS برای دامنهٔ اصلی و مجموعه‌ها"
HOSTS=("$ROOT_DOMAIN" "www.$ROOT_DOMAIN")
[ -n "$LEGACY_TENANT" ] && HOSTS+=("$LEGACY_TENANT.$ROOT_DOMAIN")
for h in $(node -e 'try{const {DatabaseSync}=require("node:sqlite");const d=new DatabaseSync("data/platform.db",{readOnly:true});for(const r of d.prepare("SELECT slug, domain FROM tenants").all()){console.log(r.slug+"."+process.argv[1]);if(r.domain)console.log(r.domain)}}catch{}' "$ROOT_DOMAIN" 2>/dev/null); do HOSTS+=("$h"); done
for h in $(printf '%s\n' "${HOSTS[@]}" | sort -u); do
  if bash "$APP_DIR/tenant-cert.sh" "$h"; then echo "  ✓ $h"; else echo "  ⚠️  $h — گواهی نگرفت (DNS را بررسی کنید؛ لاگ: /var/log/cafe-certs.log)"; fi
done

say "تمام شد ✅"
echo "  سایتِ پلتفرم (معرفی و ثبت‌نام):  https://$ROOT_DOMAIN"
echo "  پنلِ مدیرِ کل:                    https://$ROOT_DOMAIN/admin"
[ -n "$LEGACY_TENANT" ] && echo "  منوی قبلی:                        https://$LEGACY_TENANT.$ROOT_DOMAIN  (QRهای قدیمی خودکار هدایت می‌شوند)"
echo "  هر مجموعهٔ تازه:                  https://<آدرس>.$ROOT_DOMAIN  (گواهی خودکار گرفته می‌شود)"
