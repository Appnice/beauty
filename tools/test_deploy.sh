#!/usr/bin/env bash
# Offline test of the deploy scripts (make check runs it). No host, no Keychain, no network: PATH stubs for ssh,
# rsync, security, docker and curl. Checks:
#   1. tools/deploy.sh with no SSH_TARGET stops before any ssh call.
#   2. tools/deploy.sh (build on: the docker stub records the call) runs end to end: buildx for linux/amd64,
#      every remote script passes bash -n, backup (pg_dump + beauty-app:prev) before docker load, cron line, wait.
#   3. The .env it pipes over ssh has the expected keys; values come from the Keychain stub; missing items are
#      generated and stored; optional keys appear only when their item exists.
#   4. No secret value (stub or generated) in the output, in ssh/rsync arguments or in the remote scripts.
#   5. A second deploy with .env on the host does not rewrite it; the Caddy step changes nothing the second time.
#   6. tools/caddy-remote.sh on a temp Caddyfile: appends once, a failed validate restores the file byte for
#      byte, a site that stops answering restores it too; deploy-caddy.sh needs CADDYFILE and CADDY_CONTAINER.
#   7. rollback sends one valid script; tools/backup.sh keeps 14 days; no host name or IP in the deploy files.
set -euo pipefail
cd "$(dirname "$0")/.."
T=$(mktemp -d "${TMPDIR:-/tmp}/beauty-deploy-test.XXXXXX")
trap 'rm -rf "$T"' EXIT
mkdir -p "$T/bin" "$T/remote" "$T/stage"
fails=0
ok() { echo "test_deploy: ok   $1"; }
bad() { echo "test_deploy: FAIL $1"; fails=$((fails + 1)); }

cat > "$T/bin/security" <<'STUB'
#!/usr/bin/env bash
# Keychain stub: items are files kc-<name>; add-generic-password stores the value.
d=$STUB_DIR; name=""; val=""
while [ $# -gt 0 ]; do case "$1" in -s) name=$2; shift;; -w) [ $# -gt 1 ] && { val=$2; shift; };; esac; shift; done
if [ -n "$val" ]; then printf '%s' "$val" > "$d/kc-$name"; echo "add $name" >> "$d/security.log"; exit 0; fi
[ -f "$d/kc-$name" ] && { cat "$d/kc-$name"; exit 0; }
exit 44
STUB
cat > "$T/bin/ssh" <<'STUB'
#!/usr/bin/env bash
# ssh stub: logs every call; `bash -s` scripts are saved and syntax-checked; `bash -s -- args` (the Caddy step)
# runs for real against the temp Caddyfile with the docker and curl stubs.
d=$STUB_DIR; host=$1; shift; cmd="$*"
echo "ssh $host $cmd" >> "$d/ssh.log"
case "$cmd" in
  "bash -s -- "*) n=$(ls "$d/remote" | wc -l | tr -d ' '); cat > "$d/remote/$n.sh"; bash -n "$d/remote/$n.sh" || exit 2
                  shift 3; CADDY_SETTLE_S=0 CADDY_WAIT_S=0 CADDY_WAIT_TRIES=1 bash "$d/remote/$n.sh" "$@"; exit $?;;
  "bash -s") n=$(ls "$d/remote" | wc -l | tr -d ' '); cat > "$d/remote/$n.sh"; bash -n "$d/remote/$n.sh" || exit 2; exit 0;;
  *"cat > "*".env.new"*) cat > "$d/env-sent"; touch "$d/env-exists"; exit 0;;
  "test -f"*) [ -f "$d/env-exists" ] && exit 0; exit 1;;
  *"docker volume inspect"*) exit 1;;
  *"docker inspect"*"Health"*) printf healthy; exit 0;;
  *"docker stats"*) echo "beauty-app-1 90MiB / 256MiB"; exit 0;;
esac
exit 0
STUB
cat > "$T/bin/rsync" <<'STUB'
#!/usr/bin/env bash
echo "rsync $*" >> "$STUB_DIR/rsync.log"
STUB
cat > "$T/bin/curl" <<'STUB'
#!/usr/bin/env bash
# Every site answers 200; with a "down-after" file, other.example answers 502 once Caddy reloaded.
url="${*: -1}"; code=200
[ -f "$STUB_DIR/reloaded" ] && [ -f "$STUB_DIR/down-after" ] && [[ "$url" == *other.example* ]] && code=502
[[ "$*" == *"%{http_code}"* ]] && { printf '%s' "$code"; exit 0; }
printf '{"ok":true,"db":true}'
STUB
cat > "$T/bin/docker" <<'STUB'
#!/usr/bin/env bash
echo "docker $*" >> "$STUB_DIR/docker.log"
case "$*" in
  "save "*) printf 'fake image tar';;
  *"caddy validate"*) [ -f "$STUB_DIR/validate-fails" ] && exit 1; exit 0;;
  *"caddy reload"*) touch "$STUB_DIR/reloaded"; exit 0;;
  *"pg_dump"*) printf 'fake dump';;
esac
exit 0
STUB
chmod +x "$T/bin/"*
export STUB_DIR=$T PATH="$T/bin:$PATH"
printf 'FAKE-db-7f3a91' > "$T/kc-beauty-db-password"
printf 'FAKE-phone-48500' > "$T/kc-beauty-admin-phone"
printf 'FAKE-smsapi-0b1d' > "$T/kc-beauty-smsapi-token"
printf 'FAKE Operator sp. z o.o., ul. Testowa 1' > "$T/kc-beauty-operator-name"
cf=$T/Caddyfile
printf 'other.example {\n\troot * /srv\n}\n' > "$cf"; orig=$(cat "$cf")
export CADDYFILE=$cf CADDY_CONTAINER=stub-caddy CADDY_CHECK_SITES="https://other.example/"

# 1: no SSH_TARGET.
if SSH_TARGET= tools/deploy.sh > "$T/o0.log" 2>&1; then bad "deploy.sh ran without SSH_TARGET"
elif grep -q 'set SSH_TARGET' "$T/o0.log" && [ ! -f "$T/ssh.log" ]; then ok "no SSH_TARGET: exit 1 before any ssh call"
else bad "no SSH_TARGET message"; cat "$T/o0.log"; fi

# 2-4: full deploy with stubs (build step on, docker is a stub).
if STAGE="$T/stage" SSH_TARGET=stub@invalid SKIP_SMOKE=1 HEALTH_WAIT_S=0 tools/deploy.sh > "$T/out.log" 2>&1; then ok "deploy.sh exit 0 with stubs"
else bad "deploy.sh exit $?"; cat "$T/out.log"; fi
grep -q 'docker buildx build --platform linux/amd64 -f deploy/Dockerfile -t beauty-app:latest --load .' "$T/docker.log" \
  && grep -q '^docker save beauty-app:latest' "$T/docker.log" && ok "image built with buildx for linux/amd64 and saved" || bad "build step"
n=$(ls "$T/remote" | wc -l | tr -d ' ')
[ "$n" = 3 ] && ok "3 remote scripts (precheck, backup + load, caddy), each passed bash -n" || bad "remote scripts: $n (want 3)"
r1=$T/remote/1.sh
grep -q 'BACKUP_TAG=predeploy ./backup.sh' "$r1" && grep -q 'docker tag beauty-app:latest beauty-app:prev' "$r1" \
  && [ "$(grep -n 'backup.sh;' "$r1" | cut -d: -f1)" -lt "$(grep -n 'docker load' "$r1" | cut -d: -f1)" ] \
  && ok "backup (pg_dump + beauty-app:prev) runs before docker load" || bad "backup order"
grep -q '17 3 \* \* \* cd /opt/beauty && ./backup.sh' "$r1" && grep -q "grep -v '/opt/beauty/backup.sh'" "$r1" \
  && ok "nightly backup cron line, replaced not added twice" || bad "cron line"
grep -qF "deploy/compose.yml tools/backup.sh tools/restore.sh $T/stage/beauty-app.tar.gz stub@invalid:/opt/beauty/" "$T/rsync.log" \
  && ok "rsync of compose.yml, backup.sh, restore.sh and the image tar to /opt/beauty" || bad "rsync target"
! grep -qv '^ssh stub@invalid ' "$T/ssh.log" && ok "every ssh call went to SSH_TARGET only" || bad "ssh host"
keys=$(cut -d= -f1 "$T/env-sent" | tr '\n' ' ')
[ "$keys" = "BEAUTY_DB_PASSWORD APP_SECRET ADMIN_PASSWORD PUBLIC_URL APP_PORT SEED_DEMO SMS_ECHO ADMIN_PHONE SMSAPI_TOKEN OPERATOR_NAME " ] \
  && ok ".env keys: $keys" || bad ".env keys: $keys"
grep -qx 'BEAUTY_DB_PASSWORD=FAKE-db-7f3a91' "$T/env-sent" && grep -qx 'PUBLIC_URL=https://beauty.appnice.dev' "$T/env-sent" \
  && grep -qx 'SMS_ECHO=off' "$T/env-sent" && ok ".env values from the Keychain stub, PUBLIC_URL https, SMS_ECHO off" || bad ".env values"
grep -qx "OPERATOR_NAME='FAKE Operator sp. z o.o., ul. Testowa 1'" "$T/env-sent" \
  && ok "OPERATOR_NAME from Keychain beauty-operator-name, single-quoted" || bad "OPERATOR_NAME line"
grep -qx 'add beauty-app-secret' "$T/security.log" && grep -qx 'add beauty-admin-password' "$T/security.log" \
  && ! grep -q 'add beauty-db-password' "$T/security.log" && [ "$(wc -c < "$T/kc-beauty-app-secret" | tr -d ' ')" = 48 ] \
  && ok "missing beauty-app-secret and beauty-admin-password generated (48 hex) and stored" || bad "secret generation"
leak=0
cat "$T/ssh.log" "$T/rsync.log" "$T/docker.log" "$T"/remote/*.sh > "$T/args.log"
for f in "$T"/kc-*; do
  v=$(cat "$f")
  grep -qF -- "$v" "$T/out.log" && { leak=1; echo "  in the output: ${f##*/kc-}"; }
  grep -qF -- "$v" "$T/args.log" && { leak=1; echo "  in ssh/rsync/docker arguments or remote scripts: ${f##*/kc-}"; }
done
[ "$leak" = 0 ] && ok "no secret value ($(ls "$T"/kc-* | wc -l | tr -d ' ') items) in the output, arguments or remote scripts" || bad "secret leak"
[ "$(grep -c '^beauty.appnice.dev {' "$cf")" = 1 ] && ok "Caddy step added the site block" || bad "caddy block not added"

# 5: second deploy: .env exists, no rewrite; Caddy unchanged.
rm -f "$T/env-sent"; cp "$cf" "$T/cf-after-1"
STAGE="$T/stage" SSH_TARGET=stub@invalid SKIP_BUILD=1 SKIP_SMOKE=1 HEALTH_WAIT_S=0 tools/deploy.sh > "$T/out2.log" 2>&1 || { bad "second deploy"; cat "$T/out2.log"; }
[ ! -f "$T/env-sent" ] && ok "second deploy keeps the host .env (no SECRETS=1)" || bad ".env rewritten"
grep -q 'already configured, no change' "$T/out2.log" && cmp -s "$cf" "$T/cf-after-1" && [ "$(grep -c '^beauty.appnice.dev {' "$cf")" = 1 ] \
  && ok "second run adds no second site block" || bad "caddy idempotence"

# 6: caddy-remote.sh restore paths.
printf '%s\n' "$orig" > "$cf"; cp "$cf" "$T/cf-orig"; rm -f "$T"/Caddyfile.bak-* "$T/reloaded"
b64=$(tools/deploy-caddy.sh --print | base64 | tr -d '\n')
run_remote() { CADDY_SETTLE_S=0 CADDY_WAIT_S=0 CADDY_WAIT_TRIES=1 bash tools/caddy-remote.sh beauty.appnice.dev "$b64" "$cf" stub-caddy "https://other.example/" > "$T/caddy.log" 2>&1; }
touch "$T/validate-fails"
! run_remote && cmp -s "$cf" "$T/cf-orig" && grep -q 'validate failed, restoring' "$T/caddy.log" \
  && ok "failed validate restores the Caddyfile byte for byte" || { bad "restore on validate"; cat "$T/caddy.log"; }
rm -f "$T/validate-fails" "$T/reloaded"; touch "$T/down-after"
! run_remote && cmp -s "$cf" "$T/cf-orig" && grep -q 'other.example/ answered 200 before and 502 after' "$T/caddy.log" \
  && ok "a site that stops answering restores the Caddyfile" || { bad "restore on site check"; cat "$T/caddy.log"; }
rm -f "$T/down-after"
if CADDYFILE= SSH_TARGET=stub@invalid tools/deploy-caddy.sh > "$T/c3.log" 2>&1; then bad "deploy-caddy.sh ran without CADDYFILE"
else grep -q 'set CADDYFILE' "$T/c3.log" && ok "deploy-caddy.sh needs CADDYFILE (no host default)" || bad "CADDYFILE message"; fi
want=$'beauty.appnice.dev {\n\theader -Server\n\tencode zstd gzip\n\treverse_proxy 127.0.0.1:8150\n}'
[ "$(tools/deploy-caddy.sh --print)" = "$want" ] && ok "site block beauty.appnice.dev -> 127.0.0.1:8150" || bad "site block"

# 7: rollback, backup retention, no host in the files.
rm -f "$T"/remote/*
SSH_TARGET=stub@invalid HEALTH_WAIT_S=0 tools/deploy.sh rollback > "$T/rb.log" 2>&1 && [ "$(ls "$T/remote" | wc -l | tr -d ' ')" = 1 ] \
  && grep -q 'docker tag beauty-app:prev beauty-app:latest' "$T/remote/0.sh" && ok "rollback sends one valid script (prev -> latest)" || bad "rollback"
mkdir -p "$T/bk"; touch -t "$(date -v-20d +%Y%m%d%H%M)" "$T/bk/beauty-nightly-old.dump"; touch -t "$(date -v-5d +%Y%m%d%H%M)" "$T/bk/beauty-nightly-recent.dump"
BACKUP_DIR=$T/bk DB_CONTAINER=stub-db tools/backup.sh > "$T/bk.log" 2>&1
[ ! -f "$T/bk/beauty-nightly-old.dump" ] && [ -f "$T/bk/beauty-nightly-recent.dump" ] && [ "$(ls "$T"/bk/beauty-nightly-2*.dump | wc -l | tr -d ' ')" = 1 ] \
  && grep -q 'pg_dump -U beauty -d beauty -Fc' "$T/docker.log" && ok "backup.sh: new dump, 20-day-old removed, 5-day-old kept" || { bad "backup retention"; cat "$T/bk.log"; }
hits=$(grep -nE '([0-9]{1,3}\.){3}[0-9]{1,3}' deploy/* tools/*.sh compose*.yaml .env.example docs/deploy.md 2>/dev/null \
  | grep -vE '127\.0\.0\.1|0\.0\.0\.0|([0-9]{1,3}\.){3}[0-9]{1,3}/' | grep -vE 'node:[0-9]|postgres:[0-9]|caddy:[0-9]|[0-9]+\.[0-9]+\.[0-9]+-' || true)
[ -z "$hits" ] && ok "no IP address in deploy/, tools/*.sh, compose files, .env.example, docs/deploy.md" || { bad "IP found"; echo "$hits"; }

[ "$fails" = 0 ] && echo "test_deploy: PASS" || { echo "test_deploy: $fails failed"; exit 1; }
