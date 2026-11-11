#!/usr/bin/env bash
# Database backup: pg_dump (custom format) of the beauty database into $BACKUP_DIR, files older than
# $KEEP_DAYS days are removed. On the VPS it runs from cron every night (tools/deploy.sh installs the line) and
# before every deploy (BACKUP_TAG=predeploy). tools/deploy-local.sh runs it against the local stack.
# Env: DB_CONTAINER (beauty-db-1), BACKUP_DIR (<dir of this script>/backups), KEEP_DAYS (14). Reads no secret:
# pg_dump runs inside the database container as the local postgres user.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
DB=${DB_CONTAINER:-beauty-db-1}
OUT=${BACKUP_DIR:-$here/backups}
KEEP=${KEEP_DAYS:-14}
mkdir -p "$OUT"
f=$OUT/beauty-${BACKUP_TAG:-nightly}-$(date +%Y%m%d-%H%M%S).dump
docker exec "$DB" pg_dump -U beauty -d beauty -Fc > "$f.part"
mv "$f.part" "$f"
echo "backup: $f ($(du -h "$f" | cut -f1))"
# Keep $KEEP days; the dump just written always stays.
find "$OUT" -maxdepth 1 -name 'beauty-*.dump' -mtime +"$((KEEP - 1))" ! -name "$(basename "$f")" -print -delete \
  | sed 's/^/backup: removed /'
