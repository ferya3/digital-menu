#!/usr/bin/env bash
# ============================================================================
#  به‌روزرسانیِ امنِ «منوی دیجیتال کافه» روی سرور.
#  دادهٔ زمان‌اجرا (منو، تنظیمات، سفارش‌ها، عکس‌ها) حفظ می‌شود؛ فقط کد به‌روز می‌شود.
#
#  اجرا:  sudo bash update.sh
# ============================================================================
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE="${SERVICE:-cafe}"
BK="/tmp/cafe-data-backup-$$"

say(){ printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
git config --global --add safe.directory "$PWD" 2>/dev/null || true

say "پشتیبان‌گیری از data/ و عکس‌ها"
mkdir -p "$BK"
cp -r data "$BK/" 2>/dev/null || true
cp -r public/images "$BK/images" 2>/dev/null || true

say "دریافت آخرین نسخهٔ کد از گیت‌هاب"
git fetch origin
git reset --hard origin/main

say "بازگرداندن دادهٔ زمان‌اجرا (منو/تنظیمات/سفارش‌ها/عکس‌ها)"
cp -rn "$BK/data/." data/ 2>/dev/null || true
mkdir -p public/images
cp -rn "$BK/images/." public/images/ 2>/dev/null || true

say "نصب وابستگی‌ها و بیلد مجدد رابط React"
npm install --omit=dev --no-audit --no-fund
( cd web && npm install --no-audit --no-fund && npm run build )

say "ری‌استارت سرویس"
systemctl restart "$SERVICE" 2>/dev/null || true
rm -rf "$BK"
say "به‌روزرسانی کامل شد ✅   (وضعیت: systemctl status $SERVICE)"
