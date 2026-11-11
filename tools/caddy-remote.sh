#!/usr/bin/env bash
# Runs ON the VPS (tools/deploy-caddy.sh sends it over `ssh bash -s`): adds one site block to the shared Caddyfile.
#   caddy-remote.sh <domain> <site block, base64> <caddyfile> <caddy container> ["url url ..." to keep answering]
# Append only, keep a backup, validate, reload. Restores the backup when validate or reload fails, or when a site
# that answered 2xx-4xx before the change stops answering. `>>` and `cat >` keep the inode (a bind mount stays).
# Bash 3.2 safe: tools/test_deploy.sh runs it on the Mac against a temp Caddyfile with stubs. Reads no secret.
set -euo pipefail
DOMAIN=$1
BLOCK=$(printf '%s' "$2" | base64 -d)
CADDY=$3
C=$4
SITES=()
# shellcheck disable=SC2206
[ -n "${5:-}" ] && SITES=($5)
N=${#SITES[@]}
CONF=(--config "${CADDY_CONFIG_IN_CONTAINER:-/etc/caddy/Caddyfile}" --adapter caddyfile)

[ -f "$CADDY" ] || { echo "caddy: $CADDY does not exist" >&2; exit 1; }
if awk -v d="$DOMAIN" '$1 == d { f = 1 } END { exit !f }' "$CADDY"; then
  echo "caddy: $DOMAIN already configured, no change"; exit 0
fi
code_of() { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$1" || true; }
before=()
i=0
while [ "$i" -lt "$N" ]; do before[$i]=$(code_of "${SITES[$i]}"); echo "caddy: before ${SITES[$i]} -> ${before[$i]}"; i=$((i + 1)); done

bak=$CADDY.bak-beauty-$(date +%Y%m%d-%H%M%S)
cp -p "$CADDY" "$bak"
printf '\n%s\n' "$BLOCK" >> "$CADDY"
restore() {
  echo "caddy: $1, restoring $bak" >&2
  cat "$bak" > "$CADDY"
  docker exec "$C" caddy reload "${CONF[@]}" || true
  exit 1
}
docker exec "$C" caddy validate "${CONF[@]}" >/dev/null 2>&1 || restore "validate failed"
docker exec "$C" caddy reload "${CONF[@]}" || restore "reload failed"
sleep "${CADDY_SETTLE_S:-2}"
i=0
while [ "$i" -lt "$N" ]; do
  b=${before[$i]}; a=$(code_of "${SITES[$i]}")
  echo "caddy: after  ${SITES[$i]} -> $a"
  if [[ "$b" =~ ^[234] ]] && ! [[ "$a" =~ ^[234] ]]; then restore "${SITES[$i]} answered $b before and $a after"; fi
  i=$((i + 1))
done
echo "caddy: $DOMAIN added (backup $bak)"
code=000
for _ in $(seq 1 "${CADDY_WAIT_TRIES:-24}"); do
  code=$(code_of "https://$DOMAIN/health")
  [[ "$code" == 200 ]] && { echo "caddy: https://$DOMAIN/health -> 200"; exit 0; }
  sleep "${CADDY_WAIT_S:-5}"
done
echo "caddy: https://$DOMAIN/health not 200 yet (last $code); the certificate can take a few minutes" >&2
