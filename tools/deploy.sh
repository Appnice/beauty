#!/usr/bin/env bash
# MAIN SESSION ONLY. Deploys beauty to the shared VPS (https://beauty.appnice.dev). Idempotent. docs/deploy.md.
#
#   SSH_TARGET=user@host make deploy     build, back up, ship, write .env if missing, start, wait, Caddy once, smoke
#   SECRETS=1 ...                        also rewrite /opt/beauty/.env from the Keychain
#   SKIP_CADDY=1 / SKIP_SMOKE=1          leave out the Caddy step / the final smokes
#   SKIP_BUILD=1                         ship the image tar that is already in $STAGE (tools/test_deploy.sh uses it)
#   make rollback                        beauty-app:prev becomes latest again (tools/deploy.sh rollback)
#
# Build: on the Mac (docker buildx --platform linux/amd64, then docker save | gzip). The shared VPS has little RAM:
# a vite build there would starve the other apps, and the host then needs no Node, npm or source code.
# VPS: /opt/beauty (compose project `beauty`: beauty-app-1 on 127.0.0.1:8150, mem 256m; beauty-db-1 postgres 16,
# mem 256m, no published port, volume beauty_beauty-db). Backups: /opt/beauty/backups (before each update + nightly
# cron, 14 days kept). Secrets: Keychain items beauty-* -> /opt/beauty/.env over ssh stdin (umask 077), never printed:
#   generated when missing: beauty-db-password, beauty-app-secret, beauty-admin-password
#   passed only when they exist: beauty-admin-phone, beauty-admin-notify-url, beauty-signup-code, beauty-smsapi-token
#   OPERATOR_NAME (privacy page, not a secret): env OPERATOR_NAME, else Keychain beauty-operator-name; a warning when
#   neither is set (the page then shows 'operator tego serwera')
# The host name is never in the repo: SSH_TARGET comes from the environment.
set -euo pipefail
cd "$(dirname "$0")/.."

HOST=${SSH_TARGET:-}
[[ -n "$HOST" ]] || { echo "deploy: set SSH_TARGET (user@host of the VPS); it is not stored in the repo" >&2; exit 1; }
DIR=/opt/beauty
PORT=8150
DOMAIN=${DOMAIN:-beauty.appnice.dev}
PUBLIC_URL=https://$DOMAIN
STAGE=${STAGE:-build/deploy}
P="docker compose -p beauty -f $DIR/compose.yml"

kc() { security find-generic-password -s "$1" -w 2>/dev/null; }
kc_or_new() { # $1 = item; prints the value for a $(...) capture only, never to the terminal
  local v
  if ! v=$(kc "$1"); then
    v=$(openssl rand -hex 24)
    security add-generic-password -a beauty -s "$1" -w "$v"
    echo "env: Keychain $1 generated" >&2
  fi
  printf '%s' "$v"
}

wait_healthy() {
  local st
  for _ in $(seq 1 "${HEALTH_TRIES:-45}"); do
    st=$(ssh "$HOST" "docker inspect -f '{{.State.Health.Status}}' beauty-app-1 2>/dev/null || echo none")
    [[ "$st" == healthy ]] && { echo "deploy: beauty-app-1 healthy"; return 0; }
    sleep "${HEALTH_WAIT_S:-2}"
  done
  echo "deploy: beauty-app-1 is '$st'; make rollback restores the previous image" >&2
  ssh "$HOST" "docker logs --tail 40 beauty-app-1" >&2 || true
  return 1
}

if [[ "${1:-}" == rollback ]]; then
  ssh "$HOST" bash -s <<REMOTE
set -euo pipefail
cd $DIR
docker image inspect beauty-app:prev >/dev/null 2>&1 || { echo "rollback: no beauty-app:prev image" >&2; exit 1; }
docker tag beauty-app:latest beauty-app:rolledback
docker tag beauty-app:prev beauty-app:latest
$P up -d --no-build --force-recreate app
echo "rollback: beauty-app:prev is live; the rolled-back image is beauty-app:rolledback"
echo "rollback: a migration of the newer image stays in the database; tools/restore.sh restores a dump"
REMOTE
  wait_healthy
  exit 0
fi

if [[ "${SKIP_BUILD:-}" != 1 ]]; then
  mkdir -p "$STAGE"
  docker buildx build --platform linux/amd64 -f deploy/Dockerfile -t beauty-app:latest --load .
  docker save beauty-app:latest | gzip > "$STAGE/beauty-app.tar.gz"
  echo "deploy: image $(du -h "$STAGE/beauty-app.tar.gz" | cut -f1) in $STAGE"
fi
[[ -f "$STAGE/beauty-app.tar.gz" ]] || { echo "deploy: $STAGE/beauty-app.tar.gz is missing" >&2; exit 1; }

# Precheck: port 8150 free or ours, enough memory for a first start, directories.
ssh "$HOST" bash -s <<REMOTE
set -euo pipefail
if ss -ltn | grep -q '127.0.0.1:$PORT '; then
  docker ps --filter publish=$PORT --format '{{.Names}}' | grep -q '^beauty-' || { echo "port $PORT is taken by something else" >&2; exit 1; }
else
  avail=\$(awk '/MemAvailable/ {print int(\$2/1024)}' /proc/meminfo)
  (( avail >= 400 )) || { echo "VPS has \${avail} MB available; beauty needs about 300 MB" >&2; exit 1; }
fi
mkdir -p $DIR/backups
REMOTE

rsync -az deploy/compose.yml tools/backup.sh tools/restore.sh "$STAGE/beauty-app.tar.gz" "$HOST:$DIR/"

# Backup before the update (database dump + the running image as beauty-app:prev), then load the new image.
ssh "$HOST" bash -s <<REMOTE
set -euo pipefail
cd $DIR
chmod +x backup.sh restore.sh
if docker ps --format '{{.Names}}' | grep -q '^beauty-db-1\$'; then BACKUP_TAG=predeploy ./backup.sh; fi
if docker image inspect beauty-app:latest >/dev/null 2>&1; then docker tag beauty-app:latest beauty-app:prev && echo "backup: image beauty-app:prev"; fi
gunzip -c beauty-app.tar.gz | docker load
# Nightly backup at 03:17, 14 days kept (one line, replaced on every deploy).
( crontab -l 2>/dev/null | grep -v '$DIR/backup.sh' || true; echo "17 3 * * * cd $DIR && ./backup.sh >> $DIR/backups/backup.log 2>&1" ) | crontab -
REMOTE

if [[ "${SECRETS:-}" == 1 ]] || ! ssh "$HOST" "test -f $DIR/.env"; then
  # Postgres keeps the password of its first start: a new password next to an old volume locks the app out.
  if ! kc beauty-db-password >/dev/null && ssh "$HOST" "docker volume inspect beauty_beauty-db >/dev/null 2>&1"; then
    echo "env: Keychain beauty-db-password is missing but volume beauty_beauty-db exists; restore the item first" >&2
    exit 1
  fi
  dbpw=$(kc_or_new beauty-db-password)
  secret=$(kc_or_new beauty-app-secret)
  admin=$(kc_or_new beauty-admin-password)
  aphone=$(kc beauty-admin-phone || true)
  anotify=$(kc beauty-admin-notify-url || true)
  invite=$(kc beauty-signup-code || true)
  smsapi=$(kc beauty-smsapi-token || true)
  operator=${OPERATOR_NAME:-$(kc beauty-operator-name || true)}
  if [[ "$operator" == *"'"* || "$operator" == *$'\n'* ]]; then
    echo "env: OPERATOR_NAME must not contain a single quote or a new line" >&2
    exit 1
  fi
  [ -n "$operator" ] || echo "env: WARNING no OPERATOR_NAME (env or Keychain beauty-operator-name); the privacy page shows 'operator tego serwera'" >&2
  {
    printf 'BEAUTY_DB_PASSWORD=%s\nAPP_SECRET=%s\nADMIN_PASSWORD=%s\n' "$dbpw" "$secret" "$admin"
    printf 'PUBLIC_URL=%s\nAPP_PORT=%s\nSEED_DEMO=on\nSMS_ECHO=%s\n' "$PUBLIC_URL" "$PORT" "${SMS_ECHO:-off}"
    [ -n "$aphone" ] && printf 'ADMIN_PHONE=%s\n' "$aphone"
    [ -n "$anotify" ] && printf 'ADMIN_NOTIFY_URL=%s\n' "$anotify"
    [ -n "$invite" ] && printf 'SIGNUP_CODE=%s\n' "$invite"
    [ -n "$smsapi" ] && printf 'SMSAPI_TOKEN=%s\n' "$smsapi"
    [ -n "$operator" ] && printf "OPERATOR_NAME='%s'\n" "$operator"
    true
  } | ssh "$HOST" "umask 077 && cat > $DIR/.env.new && mv $DIR/.env.new $DIR/.env && chmod 600 $DIR/.env"
  echo "env: $DIR/.env written from the Keychain (admin phone: $([ -n "$aphone" ] && echo set || echo none)," \
    "notify url: $([ -n "$anotify" ] && echo set || echo none), invite code: $([ -n "$invite" ] && echo set || echo none)," \
    "smsapi token: $([ -n "$smsapi" ] && echo set || echo none; ), operator name: $([ -n "$operator" ] && echo set || echo none)," \
    "sms provider: log)"
  unset dbpw secret admin aphone anotify invite smsapi operator
fi

ssh "$HOST" "cd $DIR && $P up -d --no-build"
wait_healthy
ssh "$HOST" "docker stats --no-stream --format '{{.Name}} {{.MemUsage}}' beauty-app-1 beauty-db-1"

[[ "${SKIP_CADDY:-}" == 1 ]] || SSH_TARGET="$HOST" DOMAIN="$DOMAIN" UPSTREAM="127.0.0.1:$PORT" tools/deploy-caddy.sh

[[ "${SKIP_SMOKE:-}" == 1 ]] && { echo "deploy: smoke skipped (SKIP_SMOKE=1)"; exit 0; }
for _ in $(seq 1 30); do curl -fsS --max-time 10 "$PUBLIC_URL/health" >/dev/null 2>&1 && break; sleep 5; done
ADMIN_PASSWORD=$(kc beauty-admin-password) tools/deploy-smoke.sh "$PUBLIC_URL"
ADMIN_PASSWORD=$(kc beauty-admin-password) node tools/deploy-browser-smoke.ts "$PUBLIC_URL"
