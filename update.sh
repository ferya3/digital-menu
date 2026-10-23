#!/usr/bin/env bash
# Safe update: backs up the databases and uploads first, then gets the new code, builds and reloads.
# The data/ folder (databases + images) is not part of the code, so updates never touch it.
#   Run:  sudo bash update.sh
#
# ZIP install (no .git folder): upload/extract the new version over the old files first
# (keep data/ and .env.production.local), then run this script.
# Git install (.git folder present): the latest code of the current branch is fetched automatically.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
say(){ printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

BK_DIR=/root/cafe-backups
mkdir -p "$BK_DIR"
if [ -d data ]; then
  say "Backing up data/"
  if [ -f backup.sh ]; then
    OUT_DIR="$BK_DIR" bash backup.sh >/dev/null 2>&1 || tar -czf "$BK_DIR/data-$(date +%Y%m%d-%H%M%S).tar.gz" data
  else
    tar -czf "$BK_DIR/data-$(date +%Y%m%d-%H%M%S).tar.gz" data
  fi
fi

if [ -d .git ] && command -v git >/dev/null 2>&1; then
  git config --global --add safe.directory "$PWD" 2>/dev/null || true
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  say "Fetching the latest code ($BRANCH)"
  git fetch origin "$BRANCH:refs/remotes/origin/$BRANCH"
  git reset --hard "origin/$BRANCH"
else
  say "No git repository found — using the files already in this folder"
  echo "   (upload the new version over the old files before running update.sh)"
fi

# ffmpeg for automatic optimization of the hero video
if ! command -v ffmpeg >/dev/null 2>&1; then
  say "Installing ffmpeg"
  (apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ffmpeg) || echo "ffmpeg wasn't installed (optional)"
fi

say "Installing dependencies and building"
if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
NODE_OPTIONS="--max-old-space-size=1536" npm run build

# Hero video uploads up to 100 MB; raise the old Nginx limit (12m)
NGX=/etc/nginx/sites-available/cafe
if [ -f "$NGX" ] && grep -q "client_max_body_size 12m;" "$NGX"; then
  say "Raising the Nginx upload limit"
  sed -i 's/client_max_body_size 12m;/client_max_body_size 120m;/' "$NGX"
  nginx -t && systemctl reload nginx
fi

[ -d data ] && chmod 700 data   # databases, passwords and keys are root-only
[ -d /etc/cafe-menu ] && chmod 700 /etc/cafe-menu && chmod 600 /etc/cafe-menu/* 2>/dev/null || true
say "Reloading with zero downtime"
pm2 reload cafe --update-env || APP_PORT="${APP_PORT:-3000}" pm2 start ecosystem.config.cjs
pm2 save
say "Update complete ✅  (backups are in $BK_DIR)"
