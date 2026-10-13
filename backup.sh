#!/usr/bin/env bash
# بک‌آپِ اساسیِ سایت — برای نگهداری یا انتقال به سرورِ دیگر.
#
#   sudo bash backup.sh                       ← بک‌آپ در /root/cafe-backups
#   sudo bash backup.sh root@IP-سرور-جدید     ← بک‌آپ + ارسالِ مستقیم به سرورِ جدید (scp)
#
# شاملِ همه‌چیز: منو و دسته‌ها، تنظیمات (پرداخت، پیامک، دامنه…)، رمزِ پنل، عکس‌ها و ویدیوی هیرو،
# مشتری‌ها، سفارش‌ها، حسابداری، تاریخچهٔ پیامک‌ها. دیتابیس به‌صورتِ «نسخهٔ یکدست» گرفته می‌شود (حتی وقتی سایت در حال کار است).
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
say(){ printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
[ -f data/cafe.db ] || { echo "data/cafe.db پیدا نشد؛ از داخلِ پوشهٔ برنامه (مثلاً /opt/cafe-next) اجرا کنید."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js لازم است."; exit 1; }

OUT_DIR="${OUT_DIR:-/root/cafe-backups}"
DEST="${1:-${TO:-}}"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$OUT_DIR/data-$STAMP.tar.gz"
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT

say "گرفتنِ نسخهٔ یکدست از دیتابیس"
mkdir -p "$STAGE/data"
SRC="$PWD/data/cafe.db" OUT="$STAGE/data/cafe.db" node -e '
const { DatabaseSync } = require("node:sqlite");
const src = new DatabaseSync(process.env.SRC, { readOnly: true });
const out = process.env.OUT.replace(/\x27/g, "\x27\x27");
src.exec("VACUUM INTO \x27" + out + "\x27");   // نسخهٔ سالم و فشرده، بدونِ قفل‌کردنِ سایت
src.close();
const chk = new DatabaseSync(process.env.OUT, { readOnly: true });
const ok = chk.prepare("PRAGMA integrity_check").get();
if (Object.values(ok)[0] !== "ok") { console.error("دیتابیسِ نسخه‌برداری‌شده سالم نیست!"); process.exit(2); }
const n = (t) => { try { return chk.prepare("SELECT COUNT(*) c FROM " + t).get().c; } catch { return 0; } };
require("fs").writeFileSync(process.env.OUT + ".info", JSON.stringify({ orders: n("orders"), customers: n("customers"), items: n("items"), categories: n("categories"), campaigns: n("sms_campaigns") }));
' 2>&1 | grep -v -i "experimental\|trace-warnings" || true
[ -s "$STAGE/data/cafe.db" ] || { echo "ساختِ نسخهٔ دیتابیس ناموفق بود."; exit 1; }
INFO="$(cat "$STAGE/data/cafe.db.info")"; rm -f "$STAGE/data/cafe.db.info"

say "کپیِ عکس‌ها و فایل‌ها"
[ -d data/uploads ] && { mkdir -p "$STAGE/data/uploads"; cp -a data/uploads/. "$STAGE/data/uploads/"; rm -rf "$STAGE/data/uploads/.thumbs"; }   # بندانگشتی‌ها خودکار دوباره ساخته می‌شوند
for f in data/*; do case "$f" in data/cafe.db*|data/uploads) ;; *) [ -e "$f" ] && cp -a "$f" "$STAGE/data/" ;; esac; done
[ -f .env.production.local ] && { mkdir -p "$STAGE/env"; cp .env.production.local "$STAGE/env/"; }   # رمزِ اولیهٔ نصب
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo ?)"
cat > "$STAGE/MANIFEST.txt" <<EOF
cafe-backup
created:  $(date -Is)
host:     $(hostname)
commit:   $COMMIT
counts:   $INFO
uploads:  $(find "$STAGE/data/uploads" -type f 2>/dev/null | wc -l) files, $(du -sh "$STAGE/data/uploads" 2>/dev/null | cut -f1)
EOF

say "ساختِ فایل بک‌آپ"
tar -czf "$FILE" -C "$STAGE" .
chmod 600 "$FILE"
( cd "$OUT_DIR" && sha256sum "$(basename "$FILE")" > "$(basename "$FILE").sha256" )
ls -1t "$OUT_DIR"/data-*.tar.gz | tail -n +21 | while read -r old; do rm -f "$old" "$old.sha256"; done   # فقط ۲۰ بک‌آپِ آخر

echo
echo "✅ بک‌آپ ساخته شد"
sed 's/^/   /' "$STAGE/MANIFEST.txt" | sed -n '2,7p'
echo "   فایل: $FILE  ($(du -h "$FILE" | cut -f1))"
echo "   ⚠️ این فایل شاملِ رمزها و شمارهٔ مشتری‌هاست؛ جایی عمومی نگذارید."

if [ -n "$DEST" ]; then
  say "ارسال به $DEST"
  scp "$FILE" "$FILE.sha256" "$DEST:/root/" && {
    echo "✅ ارسال شد."
    echo
    echo "روی سرورِ جدید (بعد از نصب یا همراه نصب):"
    echo "   sudo bash /opt/cafe-next/restore.sh /root/$(basename "$FILE")"
  } || echo "⚠️ ارسال انجام نشد؛ دستی بفرستید:  scp $FILE root@IP:/root/"
else
  echo
  echo "انتقال به سرورِ جدید:"
  echo "   scp $FILE $FILE.sha256 root@IP-سرور-جدید:/root/"
  echo "   (یا همه‌چیز را یک‌جا بفرستید:  sudo bash backup.sh root@IP-سرور-جدید)"
fi
