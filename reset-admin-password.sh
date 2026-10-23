#!/usr/bin/env bash
# Reset the super-admin password (SaaS mode) — e.g. when it was changed in the panel and forgotten.
#
#  sudo PLATFORM_ADMIN_PASSWORD='New-Str0ng-Pass' bash reset-admin-password.sh
#
# Writes the new password to .env.production.local, removes the password stored by the panel
# (so the new one applies) and reloads the app. Venue data is not touched.
set -euo pipefail
die(){ echo "❌ $*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "Run with sudo"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"
ENVF="$APP_DIR/.env.production.local"
PW="${PLATFORM_ADMIN_PASSWORD:-}"
[ "${#PW}" -ge 8 ] || die "Provide the new password (at least 8 characters):  sudo PLATFORM_ADMIN_PASSWORD='…' bash reset-admin-password.sh"
[ -f data/platform.db ] || die "data/platform.db not found — is SaaS mode set up (set-saas.sh)?"

touch "$ENVF"
grep -v "^PLATFORM_ADMIN_PASSWORD=" "$ENVF" > "$ENVF.tmp" || true
printf 'PLATFORM_ADMIN_PASSWORD=%s\n' "$PW" >> "$ENVF.tmp"
mv "$ENVF.tmp" "$ENVF"; chmod 600 "$ENVF"

node -e 'const {DatabaseSync}=require("node:sqlite");const d=new DatabaseSync("data/platform.db");d.prepare("DELETE FROM settings WHERE key=?").run("admin_pw");d.close()' 2>/dev/null \
  || die "Could not update data/platform.db"

pm2 reload cafe --update-env >/dev/null 2>&1 || (APP_PORT="${APP_PORT:-3000}" pm2 start ecosystem.config.cjs >/dev/null)
echo "✅ Super-admin password reset. Sign in at /admin with the new password."
