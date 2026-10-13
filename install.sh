#!/usr/bin/env bash
# ============================================================================
#  نصب «منوی دیجیتال کافه» (Next.js) روی اوبونتو ۲۴ — اجرای دائمی با pm2
#  از داخلِ پوشهٔ همین ریپو و با root اجرا شود.
#
#  متغیرها (همه اختیاری):
#    DOMAIN          دامنه (بدون آن، سایت روی IP سرور باز می‌شود)
#    EMAIL           ایمیل برای گواهی SSL رایگان (فقط همراه با DOMAIN)
#    ADMIN_PASSWORD  رمز اولیهٔ پنل کارکنان (پیش‌فرض cafe1234 — از پنل قابل تغییر)
#    APP_PORT        پورت داخلی برنامه (پیش‌فرض 3000)
#    RESTORE         مسیر فایلِ بک‌آپِ سرور قبلی (data-*.tar.gz از backup.sh) برای انتقالِ منو، عکس‌ها،
#                    تنظیمات، مشتری‌ها و سفارش‌ها؛ رمز پنل هم از همان بک‌آپ می‌آید
#
#  نمونه با IP:      sudo ADMIN_PASSWORD='Str0ng!' bash install.sh
#  نمونه با دامنه:  sudo DOMAIN=example.com EMAIL=you@mail.com ADMIN_PASSWORD='Str0ng!' bash install.sh
# ============================================================================
set -euo pipefail

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-cafe1234}"
RESTORE="${RESTORE:-}"
PW_RESTORED=0
APP_PORT="${APP_PORT:-3000}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say(){ printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
[ "$(id -u)" -eq 0 ] || { echo "این اسکریپت را با sudo یا root اجرا کن."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

say "نصب پیش‌نیازها"
apt-get update -y
apt-get install -y curl git nginx ca-certificates ffmpeg

# ---------- Node.js 22 (برای node:sqlite) ----------
NODE_MAJOR=0
command -v node >/dev/null 2>&1 && NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  say "نصب Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
say "Node $(node -v) · npm $(npm -v)"

# ---------- swap برای سرورهای کم‌حافظه (build نکست حافظه می‌خواهد) ----------
MEM_MB="$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)"
if [ "$MEM_MB" -lt 2000 ] && ! swapon --show | grep -q .; then
  say "ساخت ۲ گیگ swap (رم سرور ${MEM_MB}MB است)"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---------- کنار گذاشتنِ نسخهٔ قبلی (سرویس systemd «cafe» در صورت وجود) ----------
if systemctl list-unit-files 2>/dev/null | grep -q '^cafe\.service'; then
  say "غیرفعال‌کردن سرویس قدیمی cafe (نسخهٔ قبلی)"
  systemctl disable --now cafe || true
fi

# ---------- نصب وابستگی‌ها و build ----------
cd "$APP_DIR"
say "نصب وابستگی‌ها"
npm ci --no-audit --no-fund
mkdir -p data/uploads
# انتقال از سرورِ قبلی: دیتابیس + عکس‌ها از فایلِ بک‌آپ برمی‌گردد (قبل از اولین اجرا)
if [ -n "$RESTORE" ]; then
  [ -f "$RESTORE" ] || { echo "فایل بک‌آپ پیدا نشد: $RESTORE"; exit 1; }
  say "بازیابی داده‌ها از $RESTORE"
  tar -xzf "$RESTORE" -C "$APP_DIR"
  [ -f "$APP_DIR/data/cafe.db" ] || { echo "این فایل بک‌آپِ معتبری نیست (data/cafe.db ندارد)"; exit 1; }
  rm -f "$APP_DIR"/data/cafe.db-wal "$APP_DIR"/data/cafe.db-shm
  # رمزِ پنل فقط وقتی در بک‌آپ هست که از داخلِ پنل عوض شده باشد؛ وگرنه رمزِ همین نصب (ADMIN_PASSWORD) اعمال می‌شود
  if (cd "$APP_DIR" && node -e 'const {DatabaseSync}=require("node:sqlite");const d=new DatabaseSync("data/cafe.db",{readOnly:true});process.exit(d.prepare("SELECT 1 FROM settings WHERE key=? AND value!=?").get("admin_pw","\"\"")?0:1)' 2>/dev/null); then
    PW_RESTORED=1
  fi
  echo "  داده‌ها بازیابی شد."
fi
# رمز اولیه؛ Next این فایل را در حالت production می‌خواند (وارد گیت نمی‌شود)
printf 'ADMIN_PASSWORD=%s\n' "$ADMIN_PASSWORD" > .env.production.local
chmod 600 .env.production.local
say "build برنامه (چند دقیقه طول می‌کشد)"
NODE_OPTIONS="--max-old-space-size=1536" npm run build

# ---------- pm2: اجرای دائمی + بالا آمدن خودکار بعد از ری‌بوت ----------
say "راه‌اندازی با pm2"
command -v pm2 >/dev/null 2>&1 || npm install -g pm2
pm2 delete cafe >/dev/null 2>&1 || true
APP_PORT="$APP_PORT" pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || echo "⚠️  راه‌اندازیِ خودکارِ pm2 بعد از ری‌بوت تنظیم نشد؛ بعداً:  pm2 startup && pm2 save"
systemctl enable pm2-root >/dev/null 2>&1 || true

# ---------- Nginx ----------
say "پیکربندی Nginx"
SERVER_NAME="${DOMAIN:-_}"
# روی سرورهایی که IPv6 ندارند «listen [::]» باعثِ خطای Nginx می‌شود
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

# فایروال (اگر فعال است)
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow OpenSSH >/dev/null || true
  ufw allow 'Nginx Full' >/dev/null || true
fi

# ---------- SSL ----------
PROTO="http"
if [ -n "$DOMAIN" ]; then
  # دامنه + HTTPS با set-domain.sh (QRهای IP هم به دامنه هدایت می‌شوند)
  if DOMAIN="$DOMAIN" EMAIL="${EMAIL:-}" APP_PORT="$APP_PORT" bash ./set-domain.sh; then
    PROTO="https"
  else
    echo "⚠️  SSL نگرفت؛ سایت روی HTTP کار می‌کند. بعد از تنظیمِ DNS:  sudo DOMAIN=$DOMAIN bash set-domain.sh"
  fi
fi

# ---------- بررسی نهایی ----------
sleep 3
CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$APP_PORT/" || true)"
HOST="${DOMAIN:-$(curl -s --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')}"
say "تمام شد ✅  (پاسخ برنامه: $CODE)"
echo "  منوی مشتری:   $PROTO://$HOST/?table=1"
echo "  پنل کارکنان:  $PROTO://$HOST/staff"
if [ "$PW_RESTORED" = "1" ]; then
  echo "  رمز پنل:      همان رمزِ سرورِ قبلی (از بک‌آپ بازیابی شد)"
else
  echo "  رمز پنل:      $ADMIN_PASSWORD   (از تنظیماتِ پنل قابل تغییر است)"
fi
echo "  وضعیت:  pm2 status   ·   لاگ:  pm2 logs cafe   ·   به‌روزرسانی:  sudo bash update.sh   ·   بک‌آپ:  sudo bash backup.sh"
if [ "$PW_RESTORED" != "1" ] && [ "$ADMIN_PASSWORD" = "cafe1234" ]; then
  echo "  ⚠️  رمز پیش‌فرض است؛ حتماً از پنل → تنظیمات عوضش کن."
fi
exit 0
