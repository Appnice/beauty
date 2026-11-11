#!/usr/bin/env bash
# Restore a dump from tools/backup.sh: stop the app, load the dump into a new database, swap it in, start the
# app, wait for health. The old database stays as beauty_before_restore until the next restore.
#   tools/restore.sh <file.dump>
# A new database, not pg_restore --clean: pg-boss keeps partitioned tables that --clean cannot drop, and a
# failed load must leave the live data as it was.
# Env: COMPOSE_PROJECT (beauty), COMPOSE_FILE_PATH (<dir of this script>/compose.yml), DB_CONTAINER (beauty-db-1),
# APP_CONTAINER (beauty-app-1). Reads no secret.
set -euo pipefail
dump=${1:?usage: restore.sh <file.dump>}
[ -s "$dump" ] || { echo "restore: $dump is missing or empty" >&2; exit 1; }
here=$(cd "$(dirname "$0")" && pwd)
PROJ=${COMPOSE_PROJECT:-beauty}
FILE=${COMPOSE_FILE_PATH:-$here/compose.yml}
DB=${DB_CONTAINER:-beauty-db-1}
APP=${APP_CONTAINER:-beauty-app-1}
compose() { docker compose -p "$PROJ" -f "$FILE" "$@"; }
pg() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$DB" psql -v ON_ERROR_STOP=1 -U beauty -d postgres -qtAc "$1"; }

pg "drop database if exists beauty_restore"
pg "create database beauty_restore"
docker exec -i "$DB" pg_restore -U beauty -d beauty_restore --no-owner --exit-on-error < "$dump" \
  || { pg "drop database if exists beauty_restore"; echo "restore: the dump did not load; live data unchanged" >&2; exit 1; }
echo "restore: dump loaded into beauty_restore"
echo "restore: stopping the app"
compose stop app
pg "drop database if exists beauty_before_restore"
pg "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'beauty' and pid <> pg_backend_pid()" >/dev/null
pg "alter database beauty rename to beauty_before_restore"
pg "alter database beauty_restore rename to beauty"
echo "restore: $dump is live (previous data: database beauty_before_restore)"
compose start app
st=none
for _ in $(seq 1 45); do
  st=$(docker inspect -f '{{.State.Health.Status}}' "$APP" 2>/dev/null || echo none)
  [ "$st" = healthy ] && { echo "restore: app healthy"; exit 0; }
  sleep 2
done
echo "restore: app is '$st' after the restore" >&2
exit 1
