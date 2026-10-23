#!/usr/bin/env bash
# Restores a backup on this server (e.g. a freshly installed server).
#   sudo bash restore.sh /root/data-XXXX.tar.gz
#
# Before restoring, this server's current data is saved too (/root/cafe-backups/before-restore-*.tar.gz).
# Variables (optional):  NO_RESTART=1     don't restart the site (used by the installer)
#                        KEEP_PASSWORD=1  keep this server's current install password (don't take the one from the backup)
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"
say(){ printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
FILE="${1:-}"
[ -n "$FILE" ] || { echo "Usage:  sudo bash restore.sh /root/data-XXXX.tar.gz"; exit 1; }
[ -f "$FILE" ] || { echo "File not found: $FILE"; exit 1; }

# 1) File integrity (if a .sha256 file is next to it)
if [ -f "$FILE.sha256" ]; then
  say "Verifying the file"
  ( cd "$(dirname "$FILE")" && sha256sum -c "$(basename "$FILE").sha256" >/dev/null 2>&1 ) \
    || { echo "❌ The file was corrupted in transfer (checksum mismatch). Please copy it again."; exit 1; }
  echo "   OK ✓"
fi
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
if [[ "$FILE" == *.enc ]]; then
  # Encrypted backup: password from BACKUP_PASSWORD, or prompted
  if [ -z "${BACKUP_PASSWORD:-}" ]; then read -r -s -p "Backup password: " BACKUP_PASSWORD; echo; export BACKUP_PASSWORD; fi
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSWORD -in "$FILE" 2>/dev/null | tar -xzf - -C "$STAGE" 2>/dev/null \
    || { echo "❌ Wrong backup password or the file is corrupted."; exit 1; }
else
  tar -xzf "$FILE" -C "$STAGE" 2>/dev/null || { echo "❌ This isn't a valid backup file."; exit 1; }
fi
[ -f "$STAGE/data/cafe.db" ] || [ -f "$STAGE/data/platform.db" ] || { echo "❌ The backup contains no database."; exit 1; }
# Integrity of every database in the backup
find "$STAGE/data" -name '*.db' -not -path '*/uploads/*' | while read -r f; do
  node -e 'const {DatabaseSync}=require("node:sqlite");const d=new DatabaseSync(process.argv[1],{readOnly:true});process.exit(Object.values(d.prepare("PRAGMA integrity_check").get())[0]==="ok"?0:1)' "$f" 2>/dev/null \
    || { echo "❌ A database in the backup failed the integrity check: ${f#$STAGE/}"; exit 1; }
done
[ -f "$STAGE/MANIFEST.txt" ] && sed 's/^/   /' "$STAGE/MANIFEST.txt" | sed -n '2,7p'

# 2) Keep the current data (if any)
RUNNING=0
if [ "${NO_RESTART:-0}" != "1" ] && command -v pm2 >/dev/null 2>&1 && pm2 describe cafe >/dev/null 2>&1; then RUNNING=1; fi
if [ -f data/cafe.db ]; then
  say "Saving this server's current data (for rollback)"
  mkdir -p /root/cafe-backups
  SAFE="/root/cafe-backups/before-restore-$(date +%Y%m%d-%H%M%S).tar.gz"
  tar -czf "$SAFE" --exclude='data/uploads/.thumbs' data && chmod 600 "$SAFE" && echo "   $SAFE"
fi

# 3) Stop, replace, start
[ "$RUNNING" = 1 ] && { say "Stopping the site temporarily"; pm2 stop cafe >/dev/null; }
say "Restoring"
rm -rf data.new && mkdir -p data.new
cp -a "$STAGE/data/." data.new/
find data.new -name '*.db-wal' -delete; find data.new -name '*.db-shm' -delete
mkdir -p data.new/uploads
rm -rf data.old && [ -d data ] && mv data data.old
mv data.new data && rm -rf data.old
# The encryption key must be restored together with the database
KEYF="${DATA_KEY_FILE:-/etc/cafe-menu/data.key}"; [ "$(id -u)" -eq 0 ] || KEYF=".data-key"
for k in "$STAGE/env/data.key" "$STAGE/env/.data-key"; do
  [ -f "$k" ] && { mkdir -p "$(dirname "$KEYF")" && chmod 700 "$(dirname "$KEYF")" 2>/dev/null; install -m 600 "$k" "$KEYF"; break; }
done
if [ -f "$STAGE/env/.env.production.local" ]; then
  # Previous server's settings (initial password; in platform mode: root domain and super admin password) — merged key by key
  touch .env.production.local
  while IFS= read -r line; do
    k="${line%%=*}"; [ -n "$k" ] && [ "$k" != "$line" ] || continue
    [ "$k" = "ADMIN_PASSWORD" ] && [ "${KEEP_PASSWORD:-0}" = "1" ] && continue
    grep -v "^$k=" .env.production.local > .env.tmp || true; printf '%s\n' "$line" >> .env.tmp; mv .env.tmp .env.production.local
  done < "$STAGE/env/.env.production.local"
  chmod 600 .env.production.local
  grep -q '^ROOT_DOMAIN=' .env.production.local && echo "   Platform mode: after restoring, run  sudo bash set-saas.sh  once (Nginx and certificates)."
fi
if [ "$RUNNING" = 1 ]; then
  say "Starting the site again"
  pm2 restart cafe --update-env >/dev/null && pm2 save >/dev/null 2>&1 || true
  sleep 3
  CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT:-3000}/" || true)"
  echo "   Site response: ${CODE:-?}"
fi
echo
echo "✅ Restore complete."
echo "   Panel password: same as on the previous server (the one set in the panel, otherwise that server's install password)."
echo "   If the domain changed:  sudo DOMAIN=new-domain.com bash set-domain.sh"
