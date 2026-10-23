#!/usr/bin/env bash
# Live demo helper (for the public demo of the product — not needed on a normal install).
#
#  1) Turn demo mode on (read-only admin, protected settings, passwords shown on the login screens):
#       sudo DEMO_ADMIN_PASSWORD='DemoAdmin2026!' DEMO_STAFF_PASSWORD='Demo1234!' bash demo-reset.sh enable
#  2) Prepare the demo data (demo venue, photos, a few orders), then save it as the baseline:
#       sudo bash demo-reset.sh save
#  3) Reset the data to the baseline every N hours (cron):
#       sudo bash demo-reset.sh cron 3          (off:  sudo bash demo-reset.sh cron off)
#  Reset right now:            sudo bash demo-reset.sh restore
#  Turn demo mode off again:   sudo bash demo-reset.sh disable
set -euo pipefail
die(){ echo "❌ $*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "Run with sudo"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"
ENVF="$APP_DIR/.env.production.local"
SNAP="$APP_DIR/demo-snapshot"
CRON=/etc/cron.d/menupilot-demo-reset

setenv(){ local k="$1" v="$2"; touch "$ENVF"; grep -v "^$k=" "$ENVF" > "$ENVF.tmp" || true; [ -n "$v" ] && printf '%s=%s\n' "$k" "$v" >> "$ENVF.tmp"; mv "$ENVF.tmp" "$ENVF"; chmod 600 "$ENVF"; }
reload(){ pm2 reload cafe --update-env >/dev/null 2>&1 || (APP_PORT="${APP_PORT:-3000}" pm2 start ecosystem.config.cjs >/dev/null); }

case "${1:-restore}" in
  enable)
    setenv DEMO_MODE 1
    setenv DEMO_ADMIN_PASSWORD "${DEMO_ADMIN_PASSWORD:-}"
    setenv DEMO_STAFF_PASSWORD "${DEMO_STAFF_PASSWORD:-}"
    reload
    echo "✅ Demo mode is on. The passwords you gave are shown on the login screens — use the same passwords for the demo accounts."
    ;;
  disable)
    setenv DEMO_MODE ""; setenv DEMO_ADMIN_PASSWORD ""; setenv DEMO_STAFF_PASSWORD ""; setenv DEMO_RESET_HOURS ""
    rm -f "$CRON"; reload
    echo "✅ Demo mode is off (the baseline in demo-snapshot/ was kept)."
    ;;
  save)
    [ -d data ] || die "No data/ folder yet"
    pm2 stop cafe >/dev/null 2>&1 || true          # consistent copy of the SQLite files
    rm -rf "$SNAP.tmp"; cp -a data "$SNAP.tmp"; rm -rf "$SNAP"; mv "$SNAP.tmp" "$SNAP"; chmod 700 "$SNAP"
    reload
    echo "✅ Baseline saved to demo-snapshot/ ($(du -sh "$SNAP" | cut -f1))."
    ;;
  restore)
    [ -d "$SNAP" ] || die "No baseline yet — run: sudo bash demo-reset.sh save"
    pm2 stop cafe >/dev/null 2>&1 || true
    rm -rf data.tmp; cp -a "$SNAP" data.tmp; rm -rf data; mv data.tmp data
    reload
    echo "✅ Demo data reset to the baseline ($(date '+%F %T'))."
    ;;
  cron)
    H="${2:-}"
    if [ "$H" = "off" ]; then rm -f "$CRON"; setenv DEMO_RESET_HOURS ""; reload; echo "✅ Automatic reset is off."; exit 0; fi
    [[ "$H" =~ ^[0-9]+$ ]] && [ "$H" -ge 1 ] && [ "$H" -le 24 ] || die "Usage: sudo bash demo-reset.sh cron <hours 1-24> | off"
    [ -d "$SNAP" ] || die "Save a baseline first: sudo bash demo-reset.sh save"
    printf 'SHELL=/bin/bash\nPATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n0 */%s * * * root bash %q restore >> /var/log/menupilot-demo-reset.log 2>&1\n' "$H" "$APP_DIR/demo-reset.sh" > "$CRON"
    chmod 644 "$CRON"
    setenv DEMO_RESET_HOURS "$H"; reload
    echo "✅ Demo data will reset every $H hour(s). Log: /var/log/menupilot-demo-reset.log"
    ;;
  *) die "Unknown command: $1 (enable | disable | save | restore | cron N|off)" ;;
esac
