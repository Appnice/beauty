#!/usr/bin/env bash
# make selfhost-check: what a self-hoster does, scripted. A fresh copy of the repo in a temp dir (no node_modules,
# .env, build), then exactly `cp .env.example .env && docker compose up -d` (project beauty-selfhost-check, port
# 8154 through the PORT/PUBLIC_URL env, which compose prefers over .env). Then the first-run wizard through the
# API (the SMS code comes from the `[sms:log]` line, as a self-hoster without a gateway reads it), and checks:
# the salon is active at once, its booking page is open, /admin does not exist, sign-up is closed after it.
# A trap runs down -v --rmi local and removes the copy. No remote host.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=$(pwd)
PROJ=beauty-selfhost-check
export PORT=8154 PUBLIC_URL=http://localhost:8154
BASE=$PUBLIC_URL
T=$(mktemp -d "${TMPDIR:-/tmp}/beauty-selfhost.XXXXXX")
n=0
ok() { n=$((n + 1)); echo "selfhost: ok   $1"; }
fail() { echo "selfhost: FAIL $1" >&2; exit 1; }
cleanup() {
  local rc=$?
  if [ -d "$T/beauty" ]; then (cd "$T/beauty" && docker compose -p "$PROJ" down -v --rmi local --remove-orphans >/dev/null 2>&1) || true; fi
  docker image rm beauty-app:selfhost >/dev/null 2>&1 || true
  rm -rf "$T"
  echo "selfhost: stack and copy removed (down -v), exit $rc"
}
trap cleanup EXIT
lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1 && fail "port $PORT is in use"

rsync -a --include .env.example --exclude node_modules --exclude .env --exclude '.env.*' --exclude build \
  --exclude .svelte-kit --exclude .git --exclude test-results --exclude playwright-report --exclude docs/screens \
  "$SRC/" "$T/beauty/"
cd "$T/beauty"
[ ! -e .env ] && [ ! -e node_modules ] && ok "fresh copy in $T/beauty (no .env, no node_modules)" || fail "copy"

cp .env.example .env
docker compose -p "$PROJ" up -d --build --wait 2>&1 | grep -E 'Healthy|Started|Error' | sed 's/^/  /' || true
[ "$(docker inspect -f '{{.State.Health.Status}}' $PROJ-app-1)" = healthy ] && ok "cp .env.example .env && docker compose up -d: app healthy" || fail "app not healthy"

j() { curl -sS --max-time 15 -H 'content-type: application/json' "$@"; }
[ "$(j "$BASE/health" | jq -r .db)" = true ] && ok "/health db true" || fail "/health"
st=$(j "$BASE/api/signup")
[ "$(jq -r .open <<<"$st")" = true ] && [ "$(jq -r .approval <<<"$st")" = false ] && ok "sign-up open, no approval: $st" || fail "signup state $st"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/admin/login")" = 404 ] && ok "/admin/login is 404 (SINGLE_SALON)" || fail "/admin exists"
[ "$(j -o /dev/null -w '%{http_code}' -X POST "$BASE/api/admin/login" --data '{"password":"x"}')" = 404 ] && ok "/api/admin/login is 404" || fail "admin api"

phone=+48604500111
j -X POST "$BASE/api/signup/code" --data "{\"phone\":\"$phone\"}" >/dev/null
code=""
for _ in 1 2 3 4 5; do
  code=$(docker compose -p "$PROJ" logs app 2>/dev/null | grep "\[sms:log\] to=$phone" | tail -1 | sed -E 's/.*body="([0-9]{6}) .*/\1/' || true)
  [[ "$code" =~ ^[0-9]{6}$ ]] && break; sleep 1
done
[[ "$code" =~ ^[0-9]{6}$ ]] && ok "sign-up code read from the [sms:log] line" || fail "no code in the log"
tok=$(j -X POST "$BASE/api/signup/verify" --data "{\"phone\":\"$phone\",\"code\":\"$code\"}" | jq -r '.phoneToken // empty')
[ -n "$tok" ] && ok "phone verified" || fail "verify"
body=$(jq -cn --arg t "$tok" '{phoneToken: $t, website: "", name: "Salon Pod Lipą", slug: "salon-pod-lipa",
  password: "haslo-wlasne-1", city: "Legnica", street: "ul. Lipowa 3", teamSize: "2–3", link: "@salonpodlipa",
  about: "Fryzjer damski i męski", team: [{name: "Ewa"}, {name: "Ola"}],
  services: [{name: "Strzyżenie damskie", durationMin: 60}, {name: "Strzyżenie męskie", durationMin: 30}],
  openingHours: [range(1;6) | {weekday: ., opens: "09:00", closes: "17:00"}]}')
r=$(j -X POST "$BASE/api/signup" --data "$body")
[ "$(jq -r .salon.status <<<"$r")" = active ] && ok "first salon created as active: $(jq -c .salon <<<"$r" | sed 's/"id":"[^"]*",//')" || fail "signup $r"
pub=$(j "$BASE/api/salon-pod-lipa")
[ "$(jq -r .salon.status <<<"$pub")" = active ] && [ "$(jq '.services | length' <<<"$pub")" = 2 ] && ok "booking page API open with 2 services" || fail "public api $pub"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/salon-pod-lipa")" = 200 ] && ok "/salon-pod-lipa 200" || fail "booking page"

st=$(j "$BASE/api/signup")
[ "$(jq -r .open <<<"$st")" = false ] && ok "sign-up closed after the first salon: $st" || fail "still open $st"
c2=$(j -o "$T/c2" -w '%{http_code}' -X POST "$BASE/api/signup/code" --data '{"phone":"+48604500222"}')
[ "$c2" = 403 ] && ok "a second sign-up code is refused: 403 $(jq -r .error.message "$T/c2")" || fail "second code $c2"
r2=$(j -o "$T/r2" -w '%{http_code}' -X POST "$BASE/api/signup" --data "$(jq -c '.slug = "drugi" | .name = "Drugi"' <<<"$body")")
[ "$r2" = 403 ] && ok "a second sign-up is refused: 403" || fail "second signup $r2 $(cat "$T/r2")"
echo "selfhost: PASS $n checks"
