#!/usr/bin/env bash
# ============================================================================
#  Installs the Digital QR Menu (Next.js) on Ubuntu 22.04/24.04 — runs permanently with pm2.
#  Run as root from inside the app folder (the folder you unzipped/uploaded).
#
#  Variables (all optional):
#    DOMAIN               Domain name (without it, the site is served on the server's IP)
#    EMAIL                Email for the free SSL certificate (only with DOMAIN)
#    ADMIN_PASSWORD       Initial staff panel password (if omitted, a strong random password is generated and printed at the end)
#    APP_PORT             Internal app port (default 3000)
#    APP_TIMEZONE         IANA time zone for reports and stats, e.g. America/New_York (default UTC)
#    DEFAULT_COUNTRY_CODE Country calling code for phone numbers typed without "+", e.g. 1 (US/Canada), 44 (UK)
#    ROOT_DOMAIN          SaaS platform mode: signup site on this domain and each venue on <slug>.ROOT_DOMAIN
#                         (together with PLATFORM_ADMIN_PASSWORD; see set-saas.sh for details)
#    RESTORE              Path to a backup from a previous server (data-*.tar.gz from backup.sh) to move the menu,
#                         images, settings, customers and orders; the panel password also comes from that backup
#                         (unless you pass ADMIN_PASSWORD)
#
#  Example with IP:      sudo ADMIN_PASSWORD='Str0ng!Pass' bash install.sh
#  Example with domain:  sudo DOMAIN=example.com EMAIL=you@example.com ADMIN_PASSWORD='Str0ng!Pass' bash install.sh
# ============================================================================
set -euo pipefail

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
ADMIN_PASSWORD_GIVEN="${ADMIN_PASSWORD:-}"   # was a password passed explicitly?
# There is no fixed default password: if none is given, a random 14-character one is generated
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(head -c 64 /dev/urandom | tr -dc 'A-Za-z0-9' | head -c 14)}"
RESTORE="${RESTORE:-}"
PW_RESTORED=0
APP_PORT="${APP_PORT:-3000}"
APP_TIMEZONE="${APP_TIMEZONE:-}"
DEFAULT_COUNTRY_CODE="${DEFAULT_COUNTRY_CODE:-}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say(){ printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
[ "$(id -u)" -eq 0 ] || { echo "Please run this script with sudo or as root."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

if [ -n "$APP_TIMEZONE" ] && ! [[ "$APP_TIMEZONE" =~ ^[A-Za-z0-9_+/-]+$ ]]; then
  echo "APP_TIMEZONE must be an IANA time zone name, e.g. America/New_York"; exit 1
fi
DEFAULT_COUNTRY_CODE="${DEFAULT_COUNTRY_CODE//[^0-9]/}"

say "Installing prerequisites"
apt-get update -y
apt-get install -y curl git nginx ca-certificates ffmpeg

# ---------- Node.js 22 (required for node:sqlite) ----------
NODE_MAJOR=0
command -v node >/dev/null 2>&1 && NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  say "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
say "Node $(node -v) · npm $(npm -v)"

# ---------- Swap for low-memory servers (the Next.js build needs memory) ----------
MEM_MB="$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)"
if [ "$MEM_MB" -lt 2000 ] && ! swapon --show | grep -q .; then
  say "Creating 2 GB of swap (server RAM is ${MEM_MB}MB)"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---------- Retire an older version (systemd service "cafe", if present) ----------
if systemctl list-unit-files 2>/dev/null | grep -q '^cafe\.service'; then
  say "Disabling the old cafe systemd service (previous version)"
  systemctl disable --now cafe || true
fi

# ---------- Dependencies and build ----------
cd "$APP_DIR"
say "Installing dependencies"
if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
mkdir -p data/uploads
chmod 700 data   # databases, passwords and keys are root-only
# Moving from a previous server: database + images + settings from the backup file (before the first start)
if [ -n "$RESTORE" ]; then
  say "Restoring data from $RESTORE"
  # An explicitly passed password is kept; otherwise the previous server's password comes from the backup
  NO_RESTART=1 KEEP_PASSWORD="$([ -n "$ADMIN_PASSWORD_GIVEN" ] && echo 1 || echo 0)" bash "$APP_DIR/restore.sh" "$RESTORE" || exit 1
  # The panel password is only in the database if it was changed from inside the panel
  if (cd "$APP_DIR" && node -e 'const {DatabaseSync}=require("node:sqlite");const d=new DatabaseSync("data/cafe.db",{readOnly:true});process.exit(d.prepare("SELECT 1 FROM settings WHERE key=? AND value!=?").get("admin_pw","\"\"")?0:1)' 2>/dev/null); then
    PW_RESTORED=1
  elif [ -z "$ADMIN_PASSWORD_GIVEN" ] && [ -f "$APP_DIR/.env.production.local" ]; then
    ADMIN_PASSWORD="$(sed -n 's/^ADMIN_PASSWORD=//p' "$APP_DIR/.env.production.local" | head -1)"
  fi
fi
# Environment file; Next.js reads it in production (never commit it)
ENVF=.env.production.local
touch "$ENVF"; chmod 600 "$ENVF"
OLD_PW="$(sed -n 's/^ADMIN_PASSWORD=//p' "$ENVF" | head -1)"
if [ -z "$ADMIN_PASSWORD_GIVEN" ] && [ -n "$OLD_PW" ]; then
  ADMIN_PASSWORD="$OLD_PW"   # re-install: keep the existing password (no new random password is printed)
  ADMIN_PASSWORD_GIVEN="$OLD_PW"
else
  # Only this key changes; other settings (like ROOT_DOMAIN) are left untouched
  { grep -v '^ADMIN_PASSWORD=' "$ENVF" || true; printf 'ADMIN_PASSWORD=%s\n' "$ADMIN_PASSWORD"; } > .env.tmp && mv .env.tmp "$ENVF"
  chmod 600 "$ENVF"
fi
# Optional regional settings: set the key when a value is given; otherwise add a commented-out example once
set_env(){ # set_env KEY VALUE COMMENT EXAMPLE
  local k="$1" v="$2" c="$3" ex="$4"
  if [ -n "$v" ]; then
    if grep -q -e "^$k=" -e "^# $k=" "$ENVF"; then sed -i "s|^\(# \)\?$k=.*|$k=$v|" "$ENVF"
    else printf '# %s\n%s=%s\n' "$c" "$k" "$v" >> "$ENVF"; fi
  elif ! grep -q -e "^$k=" -e "^# $k=" "$ENVF"; then
    printf '# %s\n# %s=%s\n' "$c" "$k" "$ex" >> "$ENVF"
  fi
  chmod 600 "$ENVF"
}
set_env APP_TIMEZONE "$APP_TIMEZONE" "Time zone for reports and stats (IANA name). Default: UTC" "America/New_York"
set_env DEFAULT_COUNTRY_CODE "$DEFAULT_COUNTRY_CODE" "Country calling code added to phone numbers typed without + (e.g. 1 = US/Canada, 44 = UK)" "1"

say "Building the app (this takes a few minutes)"
NODE_OPTIONS="--max-old-space-size=1536" npm run build

# ---------- pm2: run permanently + start automatically after reboot ----------
say "Starting with pm2"
command -v pm2 >/dev/null 2>&1 || npm install -g pm2
pm2 delete cafe >/dev/null 2>&1 || true
APP_PORT="$APP_PORT" pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || echo "⚠️  pm2 auto-start after reboot wasn't configured; later run:  pm2 startup && pm2 save"
systemctl enable pm2-root >/dev/null 2>&1 || true

# ---------- Nginx ----------
say "Configuring Nginx"
SERVER_NAME="${DOMAIN:-_}"
# On servers without IPv6, "listen [::]" makes Nginx fail
LISTEN6=""
[ -f /proc/net/if_inet6 ] && LISTEN6="listen [::]:80 default_server;"
cat >/etc/nginx/sites-available/cafe <<NGINX
server {
    listen 80 default_server;
    $LISTEN6
    server_name $SERVER_NAME;
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
    }
}
NGINX
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/cafe /etc/nginx/sites-enabled/cafe
nginx -t
systemctl enable nginx >/dev/null 2>&1 || true
systemctl restart nginx || nginx -s reload

# Firewall (if active)
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow OpenSSH >/dev/null || true
  ufw allow 'Nginx Full' >/dev/null || true
fi

# ---------- SSL ----------
PROTO="http"
if [ -n "${ROOT_DOMAIN:-}" ]; then
  # SaaS platform: Nginx for all subdomains + automatic certificate per venue
  if ROOT_DOMAIN="$ROOT_DOMAIN" EMAIL="${EMAIL:-}" APP_PORT="$APP_PORT" PLATFORM_ADMIN_PASSWORD="${PLATFORM_ADMIN_PASSWORD:-}" LEGACY_TENANT="${LEGACY_TENANT:-}" bash ./set-saas.sh; then
    PROTO="https"; DOMAIN="$ROOT_DOMAIN"
  else
    echo "⚠️  set-saas.sh didn't finish; run it again after setting up DNS:  sudo bash set-saas.sh"
  fi
elif [ -n "$DOMAIN" ]; then
  # Domain + HTTPS via set-domain.sh (IP-based QR codes are redirected to the domain too)
  if DOMAIN="$DOMAIN" EMAIL="${EMAIL:-}" APP_PORT="$APP_PORT" bash ./set-domain.sh; then
    PROTO="https"
  else
    echo "⚠️  Couldn't get an SSL certificate; the site runs on HTTP. After setting up DNS:  sudo DOMAIN=$DOMAIN bash set-domain.sh"
  fi
fi

# ---------- Final check ----------
sleep 3
CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$APP_PORT/" || true)"
HOST="${DOMAIN:-$(curl -s --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')}"
say "Done ✅  (app response: $CODE)"
if [ -n "${ROOT_DOMAIN:-}" ]; then
  echo "  Platform site and signup:  $PROTO://$ROOT_DOMAIN"
  echo "  Super admin panel:         $PROTO://$ROOT_DOMAIN/admin"
  [ -n "${LEGACY_TENANT:-}" ] && echo "  Previous menu:             $PROTO://$LEGACY_TENANT.$ROOT_DOMAIN/staff"
else
  echo "  Customer menu:   $PROTO://$HOST/?table=1"
  echo "  Staff panel:     $PROTO://$HOST/staff"
fi
if [ "$PW_RESTORED" = "1" ]; then
  echo "  Panel password:  same as on the previous server (restored from backup)"
else
  echo "  Panel password:  $ADMIN_PASSWORD   (you can change it in the panel settings)"
fi
echo "  Status:  pm2 status   ·   Logs:  pm2 logs cafe   ·   Update:  sudo bash update.sh   ·   Backup:  sudo bash backup.sh"
if [ "$PW_RESTORED" != "1" ] && [ -z "$ADMIN_PASSWORD_GIVEN" ]; then
  echo "  ⚠️  This password was generated randomly — write it down now (it's also in .env.production.local)."
fi
exit 0
