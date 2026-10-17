#!/usr/bin/env bash
# بک‌آپِ اساسیِ سایت — برای نگهداری یا انتقال به سرورِ دیگر.
#
#   sudo bash backup.sh                       ← بک‌آپ در /root/cafe-backups
#   sudo bash backup.sh root@IP-سرور-جدید     ← بک‌آپ + ارسالِ مستقیم به سرورِ جدید (scp)
#
# شاملِ همه‌چیز (در حالتِ پلتفرم: همهٔ مجموعه‌ها + اشتراک‌ها و پرداخت‌ها): منو و دسته‌ها، تنظیمات (پرداخت، پیامک، دامنه…)، رمزِ پنل، عکس‌ها و ویدیوی هیرو،
# مشتری‌ها، سفارش‌ها، حسابداری، تاریخچهٔ پیامک‌ها. دیتابیس به‌صورتِ «نسخهٔ یکدست» گرفته می‌شود (حتی وقتی سایت در حال کار است).
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
say(){ printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
[ -f data/cafe.db ] || [ -f data/platform.db ] || { echo "دیتابیسی در data/ پیدا نشد؛ از داخلِ پوشهٔ برنامه (مثلاً /opt/cafe-next) اجرا کنید."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js لازم است."; exit 1; }

OUT_DIR="${OUT_DIR:-/root/cafe-backups}"
DEST="${1:-${TO:-}}"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$OUT_DIR/data-$STAMP.tar.gz"
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT

say "گرفتنِ نسخهٔ یکدست از دیتابیس‌ها"
mkdir -p "$STAGE/data"
# همهٔ دیتابیس‌ها: تک‌مجموعه‌ای (data/cafe.db) یا پلتفرم (data/platform.db + data/tenants/*/cafe.db)
INFO="$(SRC="$PWD/data" OUT="$STAGE/data" node -e '
const { DatabaseSync } = require("node:sqlite");
const fs = require("fs"), path = require("path");
const src = process.env.SRC, out = process.env.OUT;
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, f.name);
  if (f.isDirectory()) { if (f.name !== "uploads") walk(p); } else if (f.name.endsWith(".db")) files.push(p);
} })(src);
const counts = { databases: 0, tenants: 0, orders: 0, customers: 0, items: 0 };
for (const f of files) {
  const dst = path.join(out, path.relative(src, f));
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const db = new DatabaseSync(f, { readOnly: true });
  db.exec("VACUUM INTO \x27" + dst.replace(/\x27/g, "\x27\x27") + "\x27");   // نسخهٔ سالم، بدونِ قفل‌کردنِ سایت
  db.close();
  const chk = new DatabaseSync(dst, { readOnly: true });
  if (Object.values(chk.prepare("PRAGMA integrity_check").get())[0] !== "ok") { console.error("دیتابیسِ نسخه‌برداری‌شده سالم نیست: " + f); process.exit(2); }
  const n = (t) => { try { return chk.prepare("SELECT COUNT(*) c FROM " + t).get().c; } catch { return 0; } };
  counts.databases++;
  if (path.basename(f) === "platform.db") counts.tenants = n("tenants");
  else { counts.orders += n("orders"); counts.customers += n("customers"); counts.items += n("items"); }
  chk.close();
}
console.log(JSON.stringify(counts));
' 2>/dev/null)" || { echo "ساختِ نسخهٔ دیتابیس ناموفق بود."; exit 1; }

say "کپیِ عکس‌ها و فایل‌ها"
# همهٔ فایل‌های دیگر (عکس‌ها، ویدیوها، لاگ‌ها) — دیتابیس‌ها بالا جدا گرفته شدند؛ بندانگشتی‌ها خودکار دوباره ساخته می‌شوند
tar -C data --exclude='*.db' --exclude='*.db-wal' --exclude='*.db-shm' --exclude='.thumbs' -cf - . | tar -C "$STAGE/data" -xf -
[ -f .env.production.local ] && { mkdir -p "$STAGE/env"; cp .env.production.local "$STAGE/env/"; }   # رمزِ اولیهٔ نصب
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo ?)"
cat > "$STAGE/MANIFEST.txt" <<EOF
cafe-backup
created:  $(date -Is)
host:     $(hostname)
commit:   $COMMIT
counts:   $INFO
uploads:  $(find "$STAGE/data" -path '*/uploads/*' -type f 2>/dev/null | wc -l) files, $(du -sh "$STAGE/data" 2>/dev/null | cut -f1) total
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
