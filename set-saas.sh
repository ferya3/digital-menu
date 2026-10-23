#!/usr/bin/env bash
# ============================================================================
#  Enables SaaS platform mode (many venues, each on its own subdomain)
#
#  sudo ROOT_DOMAIN=example.com EMAIL=you@example.com PLATFORM_ADMIN_PASSWORD='Str0ng!Pass' \
#       LEGACY_TENANT=mycafe bash set-saas.sh
#
#  ROOT_DOMAIN             Root domain; the landing/signup site runs on it and each venue on <slug>.ROOT_DOMAIN
#  PLATFORM_ADMIN_PASSWORD Super admin panel password (https://ROOT_DOMAIN/admin) — at least 8 characters
#  EMAIL                   (optional) Email for Let's Encrypt certificates
#  LEGACY_DOMAIN           (optional) The previous domain of that same venue (e.g. mycafe.com) is attached as its
#                          custom domain and gets a certificate; old QR codes keep working unchanged
#  LEGACY_TENANT           (optional) If this server previously ran a single venue's menu: its data is moved to
#                          this address (e.g. mycafe.example.com) and old QR codes are redirected automatically
#
#  DNS prerequisite: A records for ROOT_DOMAIN, www and "*" (all subdomains) pointing to this server's IP.
# ============================================================================
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"
say(){ printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die(){ printf '\n\033[1;31m✖ %s\033[0m\n' "$*"; exit 1; }
[ "$(id -u)" -eq 0 ] || die "Please run with sudo"

ENVF="$APP_DIR/.env.production.local"
cur(){ sed -n "s/^$1=//p" "$ENVF" 2>/dev/null | head -1; }
ROOT_DOMAIN="${ROOT_DOMAIN:-$(cur ROOT_DOMAIN)}"; ROOT_DOMAIN="${ROOT_DOMAIN#http://}"; ROOT_DOMAIN="${ROOT_DOMAIN#https://}"
ROOT_DOMAIN="$(echo "${ROOT_DOMAIN%%/*}" | tr 'A-Z' 'a-z')"; ROOT_DOMAIN="${ROOT_DOMAIN#www.}"
[ -n "$ROOT_DOMAIN" ] || die "Please provide the domain:  sudo ROOT_DOMAIN=example.com PLATFORM_ADMIN_PASSWORD='…' bash set-saas.sh"
PLATFORM_ADMIN_PASSWORD="${PLATFORM_ADMIN_PASSWORD:-$(cur PLATFORM_ADMIN_PASSWORD)}"
[ "${#PLATFORM_ADMIN_PASSWORD}" -ge 8 ] || die "Please provide PLATFORM_ADMIN_PASSWORD (super admin password, at least 8 characters)"
EMAIL="${EMAIL:-$(cur CERT_EMAIL)}"
LEGACY_TENANT="$(echo "${LEGACY_TENANT:-$(cur LEGACY_TENANT)}" | tr 'A-Z' 'a-z')"
if [ -n "$LEGACY_TENANT" ] && ! [[ "$LEGACY_TENANT" =~ ^[a-z][a-z0-9-]{2,29}$ ]]; then die "Invalid LEGACY_TENANT (lowercase letters, digits and -)"; fi
LEGACY_DOMAIN="${LEGACY_DOMAIN:-$(cur LEGACY_DOMAIN)}"; LEGACY_DOMAIN="${LEGACY_DOMAIN#http://}"; LEGACY_DOMAIN="${LEGACY_DOMAIN#https://}"
LEGACY_DOMAIN="$(echo "${LEGACY_DOMAIN%%/*}" | tr 'A-Z' 'a-z')"; LEGACY_DOMAIN="${LEGACY_DOMAIN#www.}"
if [ -n "$LEGACY_DOMAIN" ] && [ -z "$LEGACY_TENANT" ]; then die "LEGACY_DOMAIN only works together with LEGACY_TENANT"; fi
if [ -n "$LEGACY_DOMAIN" ] && [ "$LEGACY_DOMAIN" = "$ROOT_DOMAIN" ]; then die "LEGACY_DOMAIN must not be the same as ROOT_DOMAIN"; fi
APP_PORT="${APP_PORT:-$(grep -ho 'proxy_pass http://127.0.0.1:[0-9]*' /etc/nginx/sites-available/cafe 2>/dev/null | head -1 | grep -o '[0-9]*$' || true)}"
APP_PORT="${APP_PORT:-3000}"

say "Checking DNS"
command -v dig >/dev/null 2>&1 || apt-get install -y -qq dnsutils >/dev/null 2>&1 || true
MYIP="$(curl -4 -s --max-time 6 https://api.ipify.org || curl -4 -s --max-time 6 https://ifconfig.me || true)"
resolve(){ (dig +short A "$1" 2>/dev/null || getent ahostsv4 "$1" | awk '{print $1}') | grep -E '^[0-9.]+$' | head -1; }
PROBE="check-$RANDOM$RANDOM.$ROOT_DOMAIN"
IP_ROOT="$(resolve "$ROOT_DOMAIN" || true)"; IP_STAR="$(resolve "$PROBE" || true)"
echo "  This server's IP:     ${MYIP:-unknown}"
echo "  $ROOT_DOMAIN  →  ${IP_ROOT:-(not set)}"
echo "  *.$ROOT_DOMAIN  →  ${IP_STAR:-(not set)}"
[ -n "$IP_ROOT" ] || die "The A record for $ROOT_DOMAIN isn't set"
if [ -z "$IP_STAR" ] || { [ -n "$MYIP" ] && [ "$IP_STAR" != "$MYIP" ]; }; then
  echo "  ⚠️  The wildcard A record \"*\" (all subdomains) doesn't point to this server yet; venue menus won't open until it does."
fi

say "Configuring the app (.env.production.local)"
touch "$ENVF"; chmod 600 "$ENVF"
setenv(){ local k="$1" v="$2"; grep -v "^$k=" "$ENVF" > "$ENVF.tmp" || true; [ -n "$v" ] && printf '%s=%s\n' "$k" "$v" >> "$ENVF.tmp"; mv "$ENVF.tmp" "$ENVF"; chmod 600 "$ENVF"; }
setenv ROOT_DOMAIN "$ROOT_DOMAIN"
setenv PLATFORM_ADMIN_PASSWORD "$PLATFORM_ADMIN_PASSWORD"
setenv LEGACY_TENANT "$LEGACY_TENANT"
setenv LEGACY_DOMAIN "$LEGACY_DOMAIN"
setenv CERT_EMAIL "$EMAIL"
setenv AUTO_SSL 1

say "Preparing certificates (Let's Encrypt)"
command -v certbot >/dev/null 2>&1 || { apt-get update -qq; DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot; }
mkdir -p /var/www/certbot /etc/letsencrypt/renewal-hooks/deploy
chmod +x "$APP_DIR/cert-hook.sh" "$APP_DIR/tenant-cert.sh"
# After each automatic renewal, copy the new certificate for Nginx
ln -sf "$APP_DIR/cert-hook.sh" /etc/letsencrypt/renewal-hooks/deploy/cafe-tenant-certs.sh
# Existing certificates (e.g. the root domain's earlier certificate from set-domain.sh)
for L in /etc/letsencrypt/live/*/; do
  [ -f "$L/fullchain.pem" ] || continue
  DOMS="$(openssl x509 -in "$L/fullchain.pem" -noout -ext subjectAltName 2>/dev/null | grep -o 'DNS:[^,]*' | sed 's/DNS://' | tr '\n' ' ')"
  RENEWED_LINEAGE="${L%/}" RENEWED_DOMAINS="${DOMS:-$(basename "$L")}" bash "$APP_DIR/cert-hook.sh" || true
done

say "Configuring Nginx (all subdomains)"
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
# SaaS platform: one block for all domains; the app picks the venue from the Host header.
server {
    listen 80 default_server;
$( [ -n "$V6" ] && echo "    listen [::]:80 default_server;" )
    server_name _;
    location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; default_type text/plain; }
$(proxy)
        # If this host has a certificate → HTTPS
        if (-f /etc/nginx/tenant-certs/\$host/fullchain.pem) { return 301 https://\$host\$request_uri; }
    }
}
server {
    listen 443 ssl default_server;
$( [ -n "$V6" ] && echo "    listen [::]:443 ssl default_server;" )
    http2 on;
    server_name _;
    # Per-host certificate based on SNI (subdomain or custom domain)
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

say "Restarting the app"
pm2 reload cafe --update-env >/dev/null 2>&1 || (APP_PORT="$APP_PORT" pm2 start ecosystem.config.cjs)
pm2 save >/dev/null 2>&1 || true
sleep 4

say "HTTPS certificates for the root domain and venues"
HOSTS=("$ROOT_DOMAIN" "www.$ROOT_DOMAIN")
[ -n "$LEGACY_TENANT" ] && HOSTS+=("$LEGACY_TENANT.$ROOT_DOMAIN")
[ -n "$LEGACY_DOMAIN" ] && HOSTS+=("$LEGACY_DOMAIN" "www.$LEGACY_DOMAIN")
for h in $(node -e 'try{const {DatabaseSync}=require("node:sqlite");const d=new DatabaseSync("data/platform.db",{readOnly:true});for(const r of d.prepare("SELECT slug, domain FROM tenants").all()){console.log(r.slug+"."+process.argv[1]);if(r.domain)console.log(r.domain)}}catch{}' "$ROOT_DOMAIN" 2>/dev/null); do HOSTS+=("$h"); done
for h in $(printf '%s\n' "${HOSTS[@]}" | sort -u); do
  if bash "$APP_DIR/tenant-cert.sh" "$h"; then echo "  ✓ $h"; else echo "  ⚠️  $h — no certificate (check DNS; log: /var/log/cafe-certs.log)"; fi
done

say "Done ✅"
echo "  Platform site (landing and signup):  https://$ROOT_DOMAIN"
echo "  Super admin panel:                   https://$ROOT_DOMAIN/admin"
if [ -n "$LEGACY_DOMAIN" ]; then
  echo "  Previous menu:                       https://$LEGACY_DOMAIN  (same address as the printed QR codes — panel: https://$LEGACY_DOMAIN/staff)"
elif [ -n "$LEGACY_TENANT" ]; then
  echo "  Previous menu:                       https://$LEGACY_TENANT.$ROOT_DOMAIN  (old QR codes are redirected automatically)"
fi
echo "  Each new venue:                      https://<slug>.$ROOT_DOMAIN  (certificate issued automatically)"
