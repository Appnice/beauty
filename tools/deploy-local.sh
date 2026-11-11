#!/usr/bin/env bash
# make deploy-local: the production package on this Mac, from an empty volume, then down -v. No remote host.
#  1. build the production image (native arch; the linux/amd64 build of make deploy is covered by test_deploy.sh)
#  2. deploy/compose.yml as project beauty-deploy-local: app on 127.0.0.1:8152 (SMS_ECHO=on, SEED_DEMO=on, test
#     ADMIN_PASSWORD), Postgres with no published port; wait for both healthchecks
#  3. a throwaway Caddy on 127.0.0.1:8153 with the site block of tools/deploy-caddy.sh --print
#  4. tools/deploy-smoke.sh + tools/deploy-browser-smoke.ts, directly and through Caddy; then the app's cgroup
#     memory.peak (the highest charge since start) must stay under the 256m cap
#  5. trusted-proxy IP check, backup + restore round trip, /health 503 with the db stopped and 200 after
#  A trap removes the containers, the network, the volume and the image.
set -euo pipefail
cd "$(dirname "$0")/.."
PROJ=beauty-deploy-local
APP_PORT=8152
CADDY_PORT=8153
CADDY_NAME=$PROJ-caddy
IMG_TAG=deploy-local
T=$(mktemp -d "${TMPDIR:-/tmp}/beauty-deploy-local.XXXXXX")
export BEAUTY_TAG=$IMG_TAG APP_PORT BEAUTY_DB_PASSWORD=local-test-db-pw APP_SECRET=local-test-app-secret \
  PUBLIC_URL=http://localhost:$APP_PORT SMS_ECHO=on SEED_DEMO=on ADMIN_PASSWORD=local-test-admin-pw \
  ADMIN_PHONE=+48500900900 ADMIN_NOTIFY_URL=
C=(docker compose -p "$PROJ" -f deploy/compose.yml)
log() { echo "deploy-local: $*"; }
psql_q() { docker exec "$PROJ-db-1" psql -U beauty -d beauty -tAc "$1"; }

cleanup() {
  local rc=$?
  docker rm -f "$CADDY_NAME" >/dev/null 2>&1 || true
  "${C[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  docker image rm "beauty-app:$IMG_TAG" >/dev/null 2>&1 || true
  rm -rf "$T"
  log "stack removed (down -v), exit $rc"
}
trap cleanup EXIT

for p in $APP_PORT $CADDY_PORT; do
  if lsof -nP -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1; then echo "deploy-local: port $p is in use" >&2; exit 1; fi
done

log "1/5 build the production image"
docker build -q -f deploy/Dockerfile -t "beauty-app:$IMG_TAG" . >/dev/null
log "image $(docker image inspect -f '{{.Size}}' "beauty-app:$IMG_TAG" | awk '{printf "%.0f MB", $1/1e6}')"

log "2/5 compose up from an empty volume"
"${C[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
"${C[@]}" up -d --wait
docker ps --filter "name=$PROJ-" --format '{{.Names}} {{.Status}} {{.Ports}}'
"${C[@]}" logs app | grep -E '^\S*\s*\|?\s*\[db\]' | sed 's/^/  /' || true
[ -z "$(docker port "$PROJ-db-1")" ] && log "db has no published port" || { echo "deploy-local: db publishes a port" >&2; exit 1; }
[ "$(psql_q "select count(*) from salon where slug = 'demo' and is_demo")" = 1 ] && log "demo salon seeded" \
  || { echo "deploy-local: no demo salon" >&2; exit 1; }

log "3/5 throwaway Caddy on $CADDY_PORT with the deploy-caddy.sh site block"
tools/deploy-caddy.sh --print ':80' 'app:3000' > "$T/Caddyfile"
sed 's/^/  /' "$T/Caddyfile"
# docker cp, not a bind mount: the Docker VM may not share the temp dir.
docker create --name "$CADDY_NAME" --network "${PROJ}_default" -p "127.0.0.1:$CADDY_PORT:80" caddy:2.10.2-alpine >/dev/null
docker cp "$T/Caddyfile" "$CADDY_NAME:/etc/caddy/Caddyfile"
docker start "$CADDY_NAME" >/dev/null
docker exec "$CADDY_NAME" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1 | tail -1
for _ in $(seq 1 30); do curl -fsS -o /dev/null "http://127.0.0.1:$CADDY_PORT/health" 2>/dev/null && break; sleep 1; done

log "4/5 smokes, then memory"
export DEMO_MANAGER_PASSWORD=demo1234
tools/deploy-smoke.sh "http://localhost:$APP_PORT"
tools/deploy-smoke.sh "http://localhost:$CADDY_PORT"
node tools/deploy-browser-smoke.ts "http://localhost:$APP_PORT"
node tools/deploy-browser-smoke.ts "http://localhost:$CADDY_PORT"
docker stats --no-stream --format '{{.Name}} {{.MemUsage}}' "$PROJ-app-1" "$PROJ-db-1" | sed 's/^/deploy-local: docker stats after the smokes: /'
# cgroup v2 memory.peak = the highest charge since the container start (page cache included), what the cap counts.
peak=$(docker exec "$PROJ-app-1" cat /sys/fs/cgroup/memory.peak | awk '{printf "%.1f", $1/1048576}')
cap=$(docker exec "$PROJ-app-1" cat /sys/fs/cgroup/memory.max | awk '{printf "%.0f", $1/1048576}')
log "memory app: cgroup memory.peak ${peak} MiB, memory.max ${cap} MiB"
awk -v m="$peak" 'BEGIN { exit !(m < 256) }' || { echo "deploy-local: app memory peak $peak MiB is not under 256" >&2; exit 1; }

log "5/5 proxy IP, backup + restore, /health with the db stopped"
ips=$(psql_q "select distinct split_part(key, ':', 2) from rate_limit where key like 'admin-login-ip:%' order by 1" | tr '\n' ' ')
log "admin login IPs seen by the app: $ips"
[[ "$ips" == *unknown* && "$ips" =~ [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+ ]] \
  && log "direct requests have no proxy header ('unknown'); through Caddy the app sees the client IP" \
  || { echo "deploy-local: unexpected client IPs: $ips" >&2; exit 1; }
BACKUP_DIR=$T/backups DB_CONTAINER=$PROJ-db-1 tools/backup.sh
psql_q "update salon set name = 'Zmienione po kopii' where slug = 'demo'" >/dev/null
COMPOSE_PROJECT=$PROJ COMPOSE_FILE_PATH=deploy/compose.yml DB_CONTAINER=$PROJ-db-1 APP_CONTAINER=$PROJ-app-1 \
  tools/restore.sh "$(ls "$T"/backups/beauty-*.dump | head -1)"
[ "$(psql_q "select name from salon where slug = 'demo'")" = 'Salon Demo' ] && log "restore brought the old salon name back" \
  || { echo "deploy-local: restore did not bring the data back" >&2; exit 1; }
# A hanging database (paused: TCP open, no answer) must give 503 within the 3 s timeout, not hang.
"${C[@]}" pause db >/dev/null
t0=$(date +%s)
code=$(curl -s -o "$T/h.json" -w '%{http_code}' --max-time 10 "http://localhost:$APP_PORT/health" || true)
log "/health with the db paused: $code $(cat "$T/h.json") in $(( $(date +%s) - t0 )) s"
"${C[@]}" unpause db >/dev/null
[ "$code" = 503 ] || { echo "deploy-local: /health gave $code with the db paused" >&2; exit 1; }
for _ in $(seq 1 15); do curl -fsS -o /dev/null --max-time 5 "http://localhost:$APP_PORT/health" && break; sleep 1; done
"${C[@]}" stop db >/dev/null
t0=$(date +%s)
code=$(curl -s -o "$T/h.json" -w '%{http_code}' --max-time 10 "http://localhost:$APP_PORT/health" || true)
log "/health with the db stopped: $code $(cat "$T/h.json") in $(( $(date +%s) - t0 )) s"
[ "$code" = 503 ] || { echo "deploy-local: /health gave $code with the db stopped" >&2; exit 1; }
"${C[@]}" start db >/dev/null
for _ in $(seq 1 30); do
  code=$(curl -s -o "$T/h.json" -w '%{http_code}' --max-time 5 "http://localhost:$APP_PORT/health" || true)
  [ "$code" = 200 ] && break; sleep 1
done
log "/health with the db started again: $code $(cat "$T/h.json")"
[ "$code" = 200 ] || exit 1
log "PASS"
