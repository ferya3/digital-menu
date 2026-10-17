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
if [[ "$FILE" == *.enc ]]; then
  # بک‌آپِ رمزدار: رمز از BACKUP_PASSWORD یا پرسیده می‌شود
  if [ -z "${BACKUP_PASSWORD:-}" ]; then read -r -s -p "رمزِ بک‌آپ: " BACKUP_PASSWORD; echo; export BACKUP_PASSWORD; fi
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSWORD -in "$FILE" 2>/dev/null | tar -xzf - -C "$STAGE" 2>/dev/null \
    || { echo "❌ رمزِ بک‌آپ اشتباه است یا فایل خراب است."; exit 1; }
else
  tar -xzf "$FILE" -C "$STAGE" 2>/dev/null || { echo "❌ این فایلِ بک‌آپِ معتبری نیست."; exit 1; }
fi
[ -f "$STAGE/data/cafe.db" ] || [ -f "$STAGE/data/platform.db" ] || { echo "❌ بک‌آپ دیتابیس ندارد."; exit 1; }
# سلامتِ همهٔ دیتابیس‌های داخلِ بک‌آپ
find "$STAGE/data" -name '*.db' -not -path '*/uploads/*' | while read -r f; do
  node -e 'const {DatabaseSync}=require("node:sqlite");const d=new DatabaseSync(process.argv[1],{readOnly:true});process.exit(Object.values(d.prepare("PRAGMA integrity_check").get())[0]==="ok"?0:1)' "$f" 2>/dev/null \
    || { echo "❌ دیتابیسِ داخلِ بک‌آپ سالم نیست: ${f#$STAGE/}"; exit 1; }
done
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
find data.new -name '*.db-wal' -delete; find data.new -name '*.db-shm' -delete
mkdir -p data.new/uploads
rm -rf data.old && [ -d data ] && mv data data.old
mv data.new data && rm -rf data.old
# کلیدِ اطلاعاتِ رمزشده باید همراهِ دیتابیس برگردد
[ -f "$STAGE/env/.data-key" ] && install -m 600 "$STAGE/env/.data-key" .data-key
if [ -f "$STAGE/env/.env.production.local" ]; then
  # تنظیماتِ سرورِ قبلی (رمزِ اولیه، و در حالتِ پلتفرم: دامنهٔ اصلی و رمزِ مدیرِ کل) — کلید به کلید ادغام می‌شود
  touch .env.production.local
  while IFS= read -r line; do
    k="${line%%=*}"; [ -n "$k" ] && [ "$k" != "$line" ] || continue
    [ "$k" = "ADMIN_PASSWORD" ] && [ "${KEEP_PASSWORD:-0}" = "1" ] && continue
    grep -v "^$k=" .env.production.local > .env.tmp || true; printf '%s\n' "$line" >> .env.tmp; mv .env.tmp .env.production.local
  done < "$STAGE/env/.env.production.local"
  chmod 600 .env.production.local
  grep -q '^ROOT_DOMAIN=' .env.production.local && echo "   حالتِ پلتفرم: بعد از بازیابی یک‌بار  sudo bash set-saas.sh  را اجرا کنید (Nginx و گواهی‌ها)."
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
