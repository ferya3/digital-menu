#!/usr/bin/env bash
# کپیِ گواهیِ Let's Encrypt برای Nginx (هم بعد از صدور، هم بعد از هر تمدیدِ خودکار).
# Nginx گواهیِ هر زیردامنه را از /etc/nginx/tenant-certs/<host>/ می‌خواند (بر اساسِ SNI).
# certbot متغیرهای RENEWED_LINEAGE و RENEWED_DOMAINS را می‌دهد.
set -eu
L="${RENEWED_LINEAGE:?RENEWED_LINEAGE لازم است}"
DOMS="${RENEWED_DOMAINS:-$(basename "$L")}"
BASE=/etc/nginx/tenant-certs
GRP=www-data; getent group "$GRP" >/dev/null 2>&1 || GRP=root
mkdir -p "$BASE"; chown root:"$GRP" "$BASE"; chmod 750 "$BASE"
for d in $DOMS; do
  case "$d" in *'*'*|*/*|'') continue ;; esac
  mkdir -p "$BASE/$d"; chown root:"$GRP" "$BASE/$d"; chmod 750 "$BASE/$d"
  install -m 640 -o root -g "$GRP" "$L/fullchain.pem" "$BASE/$d/fullchain.pem"
  install -m 640 -o root -g "$GRP" "$L/privkey.pem" "$BASE/$d/privkey.pem"
done
if nginx -t >/dev/null 2>&1; then systemctl reload nginx 2>/dev/null || nginx -s reload 2>/dev/null || true; fi
