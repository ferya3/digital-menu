#!/usr/bin/env bash
# به‌روزرسانیِ امن: اول از دیتابیس و آپلودها بک‌آپ می‌گیرد، بعد کد را می‌گیرد، build و ری‌لود می‌کند.
# دادهٔ data/ (دیتابیس + عکس‌ها) وارد گیت نیست، پس با به‌روزرسانی دست نمی‌خورد.
#   اجرا:  sudo bash update.sh
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
say(){ printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
git config --global --add safe.directory "$PWD" 2>/dev/null || true

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
BK_DIR=/root/cafe-backups
mkdir -p "$BK_DIR"
if [ -d data ]; then
  say "بک‌آپ از data/"
  if [ -f backup.sh ]; then
    OUT_DIR="$BK_DIR" bash backup.sh >/dev/null 2>&1 || tar -czf "$BK_DIR/data-$(date +%Y%m%d-%H%M%S).tar.gz" data
  else
    tar -czf "$BK_DIR/data-$(date +%Y%m%d-%H%M%S).tar.gz" data
  fi
fi

say "دریافت آخرین کد ($BRANCH)"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# ffmpeg برای سبک‌سازیِ خودکارِ ویدیوی صفحهٔ اول
if ! command -v ffmpeg >/dev/null 2>&1; then
  say "نصب ffmpeg"
  (apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ffmpeg) || echo "نصب ffmpeg انجام نشد (اختیاری)"
fi

say "نصب وابستگی‌ها و build"
npm ci --no-audit --no-fund
NODE_OPTIONS="--max-old-space-size=1536" npm run build

# آپلودِ ویدیوی هیرو تا ۱۰۰ مگابایت؛ سقفِ قدیمیِ Nginx (۱۲m) را بالا می‌برد
NGX=/etc/nginx/sites-available/cafe
if [ -f "$NGX" ] && grep -q "client_max_body_size 12m;" "$NGX"; then
  say "افزایش سقف آپلود Nginx"
  sed -i 's/client_max_body_size 12m;/client_max_body_size 120m;/' "$NGX"
  nginx -t && systemctl reload nginx
fi

say "ری‌لود بدون قطعی"
pm2 reload cafe --update-env || APP_PORT="${APP_PORT:-3000}" pm2 start ecosystem.config.cjs
pm2 save
say "به‌روزرسانی کامل شد ✅  (بک‌آپ‌ها در $BK_DIR)"
