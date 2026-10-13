#!/usr/bin/env bash
# بک‌آپِ کاملِ داده‌های سایت (منو، عکس‌ها و ویدیو، تنظیمات و رمز پنل، مشتری‌ها، سفارش‌ها، پیامک‌ها، حسابداری).
#   اجرا:  sudo bash backup.sh            ← فایل را در /root/cafe-backups می‌سازد و مسیرش را چاپ می‌کند
# برای انتقال به سرور جدید: فایل را با scp ببرید و موقعِ نصب RESTORE=مسیر-فایل بدهید (README را ببینید).
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -d data ] || { echo "پوشهٔ data پیدا نشد؛ از داخلِ پوشهٔ برنامه اجرا کنید."; exit 1; }
OUT_DIR="${OUT_DIR:-/root/cafe-backups}"
mkdir -p "$OUT_DIR"
# اگر دیتابیس در حالِ نوشتن است، یک نسخهٔ سازگار بگیر (WAL را در فایل اصلی ادغام کن)
if command -v node >/dev/null 2>&1; then
  node -e 'try{const {DatabaseSync}=require("node:sqlite");const d=new DatabaseSync("data/cafe.db");d.exec("PRAGMA wal_checkpoint(TRUNCATE)");d.close()}catch(e){}' 2>/dev/null || true
fi
FILE="$OUT_DIR/data-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$FILE" --exclude='data/uploads/.thumbs' --exclude='*.db-wal' --exclude='*.db-shm' data
ls -1t "$OUT_DIR"/data-*.tar.gz | tail -n +21 | xargs -r rm -f   # فقط ۲۰ بک‌آپِ آخر
echo
echo "✅ بک‌آپ ساخته شد: $FILE  ($(du -h "$FILE" | cut -f1))"
echo "   انتقال به سرور جدید:  scp $FILE root@IP-سرور-جدید:/root/"
