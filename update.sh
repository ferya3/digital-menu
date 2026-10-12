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
  tar -czf "$BK_DIR/data-$(date +%Y%m%d-%H%M%S).tar.gz" data
  ls -1t "$BK_DIR"/data-*.tar.gz | tail -n +11 | xargs -r rm -f   # فقط ۱۰ بک‌آپ آخر
fi

say "دریافت آخرین کد ($BRANCH)"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

say "نصب وابستگی‌ها و build"
npm ci --no-audit --no-fund
NODE_OPTIONS="--max-old-space-size=1536" npm run build

say "ری‌لود بدون قطعی"
pm2 reload cafe --update-env || APP_PORT="${APP_PORT:-3000}" pm2 start ecosystem.config.cjs
pm2 save
say "به‌روزرسانی کامل شد ✅  (بک‌آپ‌ها در $BK_DIR)"
