#!/usr/bin/env bash
# Full site backup — for safekeeping or moving to another server.
#
#   sudo bash backup.sh                       → backup in /root/cafe-backups
#   sudo bash backup.sh root@NEW-SERVER-IP    → backup + copy straight to the new server (scp)
#
# Includes everything (in platform mode: all venues + subscriptions and payments): menu and categories, settings (payments, SMS, domain…),
# panel password, images and hero video, customers, orders, accounting, SMS history. Databases are copied as a consistent snapshot
# (even while the site is running).
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
say(){ printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
[ -f data/cafe.db ] || [ -f data/platform.db ] || { echo "No database found in data/. Run this from inside the app folder (e.g. /opt/cafe-next)."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required."; exit 1; }

OUT_DIR="${OUT_DIR:-/root/cafe-backups}"
DEST="${1:-${TO:-}}"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$OUT_DIR/data-$STAMP.tar.gz"
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT

say "Taking a consistent snapshot of the databases"
mkdir -p "$STAGE/data"
# All databases: single venue (data/cafe.db) or platform (data/platform.db + data/tenants/*/cafe.db)
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
  db.exec("VACUUM INTO \x27" + dst.replace(/\x27/g, "\x27\x27") + "\x27");   // clean copy without locking the site
  db.close();
  const chk = new DatabaseSync(dst, { readOnly: true });
  if (Object.values(chk.prepare("PRAGMA integrity_check").get())[0] !== "ok") { console.error("The copied database failed the integrity check: " + f); process.exit(2); }
  const n = (t) => { try { return chk.prepare("SELECT COUNT(*) c FROM " + t).get().c; } catch { return 0; } };
  counts.databases++;
  if (path.basename(f) === "platform.db") counts.tenants = n("tenants");
  else { counts.orders += n("orders"); counts.customers += n("customers"); counts.items += n("items"); }
  chk.close();
}
console.log(JSON.stringify(counts));
' 2>/dev/null)" || { echo "Creating the database snapshot failed."; exit 1; }

say "Copying images and files"
# All other files (images, videos, logs) — databases were copied above; thumbnails are rebuilt automatically
tar -C data --exclude='*.db' --exclude='*.db-wal' --exclude='*.db-shm' --exclude='.thumbs' -cf - . | tar -C "$STAGE/data" -xf -
[ -f .env.production.local ] && { mkdir -p "$STAGE/env"; cp .env.production.local "$STAGE/env/"; }   # install-time settings and password
# The encryption key is kept apart from the data: only included in encrypted backups (BACKUP_PASSWORD) or with INCLUDE_KEY=1
KEYF="${DATA_KEY_FILE:-/etc/cafe-menu/data.key}"; [ -f "$KEYF" ] || KEYF=".data-key"
KEY_INCLUDED=0
if [ -f "$KEYF" ] && { [ -n "${BACKUP_PASSWORD:-}" ] || [ "${INCLUDE_KEY:-0}" = "1" ]; }; then
  mkdir -p "$STAGE/env"; install -m 600 "$KEYF" "$STAGE/env/data.key"; KEY_INCLUDED=1
fi
COMMIT="$( { [ -d .git ] && git rev-parse --short HEAD 2>/dev/null; } || echo "-")"
cat > "$STAGE/MANIFEST.txt" <<EOF
cafe-backup
created:  $(date -Is)
host:     $(hostname)
commit:   $COMMIT
counts:   $INFO
uploads:  $(find "$STAGE/data" -path '*/uploads/*' -type f 2>/dev/null | wc -l) files, $(du -sh "$STAGE/data" 2>/dev/null | cut -f1) total
EOF

say "Creating the backup file"
if [ -n "${BACKUP_PASSWORD:-}" ]; then
  # Encrypted backup (AES-256): without this password the file is unreadable even if it leaks
  FILE="$FILE.enc"
  tar -czf - -C "$STAGE" . | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -pass env:BACKUP_PASSWORD -out "$FILE"
else
  tar -czf "$FILE" -C "$STAGE" .
fi
chmod 600 "$FILE"
( cd "$OUT_DIR" && sha256sum "$(basename "$FILE")" > "$(basename "$FILE").sha256" )
ls -1t "$OUT_DIR"/data-*.tar.gz* 2>/dev/null | grep -v '\.sha256$' | tail -n +21 | while read -r old; do rm -f "$old" "$old.sha256"; done   # keep only the last 20 backups

echo
echo "✅ Backup created"
sed 's/^/   /' "$STAGE/MANIFEST.txt" | sed -n '2,7p'
echo "   File: $FILE  ($(du -h "$FILE" | cut -f1))"
if [ -n "${BACKUP_PASSWORD:-}" ]; then
  echo "   🔒 Encrypted: restoring needs the same BACKUP_PASSWORD (if you lose it, the backup is unusable)."
else
  echo "   ⚠️ This file contains customer phone numbers and orders — don't store it anywhere public. (Encrypted backup:  sudo BACKUP_PASSWORD='…' bash backup.sh)"
fi
if [ "$KEY_INCLUDED" = "0" ] && [ -f "$KEYF" ]; then
  echo "   🔑 The encryption key ($KEYF) is intentionally not in this backup. To move to another server, make an encrypted backup,"
  echo "      or keep the key separately (somewhere safe); without it only the SMS/Stripe credentials need to be re-entered."
fi

if [ -n "$DEST" ]; then
  say "Sending to $DEST"
  scp "$FILE" "$FILE.sha256" "$DEST:/root/" && {
    echo "✅ Sent."
    echo
    echo "On the new server (after installing, or during install with RESTORE=…):"
    echo "   sudo bash /opt/cafe-next/restore.sh /root/$(basename "$FILE")"
  } || echo "⚠️ Sending failed; copy it manually:  scp $FILE root@IP:/root/"
else
  echo
  echo "To move to a new server:"
  echo "   scp $FILE $FILE.sha256 root@NEW-SERVER-IP:/root/"
  echo "   (or do it in one step:  sudo bash backup.sh root@NEW-SERVER-IP)"
fi
