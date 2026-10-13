#!/usr/bin/env bash
# بازگرداندنِ بک‌آپ روی همین سرور (مثلاً سرورِ تازه‌نصب‌شده).
#   sudo bash restore.sh /root/data-XXXX.tar.gz
#
# قبل از بازیابی، دادهٔ فعلیِ همین سرور هم نگه داشته می‌شود (/root/cafe-backups/before-restore-*.tar.gz).
# متغیرها (اختیاری):  NO_RESTART=1  بدونِ ری‌استارتِ سایت (نصب‌کننده از آن استفاده می‌کند)
#                     KEEP_PASSWORD=1  رمزِ نصبِ فعلیِ این سرور حفظ شود (رمزِ بک‌آپ جایگزین نشود)
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"
say(){ printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
FILE="${1:-}"
[ -n "$FILE" ] || { echo "استفاده:  sudo bash restore.sh /root/data-XXXX.tar.gz"; exit 1; }
[ -f "$FILE" ] || { echo "فایل پیدا نشد: $FILE"; exit 1; }

# ۱) سلامتِ فایل (اگر فایلِ .sha256 کنارش باشد)
if [ -f "$FILE.sha256" ]; then
  say "بررسیِ سلامتِ فایل"
  ( cd "$(dirname "$FILE")" && sha256sum -c "$(basename "$FILE").sha256" >/dev/null 2>&1 ) \
    || { echo "❌ فایل در انتقال خراب شده (checksum نمی‌خواند). دوباره بفرستید."; exit 1; }
  echo "   سالم است ✓"
fi
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
tar -xzf "$FILE" -C "$STAGE" 2>/dev/null || { echo "❌ این فایلِ بک‌آپِ معتبری نیست."; exit 1; }
[ -f "$STAGE/data/cafe.db" ] || { echo "❌ بک‌آپ دیتابیس ندارد (data/cafe.db)."; exit 1; }
node -e 'const {DatabaseSync}=require("node:sqlite");const d=new DatabaseSync(process.argv[1],{readOnly:true});process.exit(Object.values(d.prepare("PRAGMA integrity_check").get())[0]==="ok"?0:1)' "$STAGE/data/cafe.db" 2>/dev/null \
  || { echo "❌ دیتابیسِ داخلِ بک‌آپ سالم نیست."; exit 1; }
[ -f "$STAGE/MANIFEST.txt" ] && sed 's/^/   /' "$STAGE/MANIFEST.txt" | sed -n '2,7p'

# ۲) نگه‌داشتنِ دادهٔ فعلی (اگر چیزی هست)
RUNNING=0
if [ "${NO_RESTART:-0}" != "1" ] && command -v pm2 >/dev/null 2>&1 && pm2 describe cafe >/dev/null 2>&1; then RUNNING=1; fi
if [ -f data/cafe.db ]; then
  say "ذخیرهٔ دادهٔ فعلی این سرور (برای برگشت)"
  mkdir -p /root/cafe-backups
  SAFE="/root/cafe-backups/before-restore-$(date +%Y%m%d-%H%M%S).tar.gz"
  tar -czf "$SAFE" --exclude='data/uploads/.thumbs' data && chmod 600 "$SAFE" && echo "   $SAFE"
fi

# ۳) توقف، جایگزینی، شروع
[ "$RUNNING" = 1 ] && { say "توقفِ موقتِ سایت"; pm2 stop cafe >/dev/null; }
say "بازیابی"
rm -rf data.new && mkdir -p data.new
cp -a "$STAGE/data/." data.new/
rm -f data.new/cafe.db-wal data.new/cafe.db-shm
mkdir -p data.new/uploads
rm -rf data.old && [ -d data ] && mv data data.old
mv data.new data && rm -rf data.old
if [ -f "$STAGE/env/.env.production.local" ] && [ "${KEEP_PASSWORD:-0}" != "1" ]; then
  # رمزِ اولیهٔ نصبِ سرورِ قبلی (فقط وقتی لازم است که رمز از داخلِ پنل عوض نشده باشد)
  cp "$STAGE/env/.env.production.local" .env.production.local && chmod 600 .env.production.local
fi
if [ "$RUNNING" = 1 ]; then
  say "شروعِ دوبارهٔ سایت"
  pm2 restart cafe --update-env >/dev/null && pm2 save >/dev/null 2>&1 || true
  sleep 3
  CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT:-3000}/" || true)"
  echo "   پاسخِ سایت: ${CODE:-?}"
fi
echo
echo "✅ بازیابی کامل شد."
echo "   رمزِ پنل: همان رمزِ سرورِ قبلی (از پنل عوض کرده بودید = همان؛ وگرنه رمزِ زمانِ نصبِ آن سرور)."
echo "   اگر دامنه عوض شده: sudo DOMAIN=دامنهٔ-جدید bash set-domain.sh"
