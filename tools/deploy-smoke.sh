#!/usr/bin/env bash
# HTTP smoke of a running instance (curl + jq). tools/deploy-local.sh and tools/deploy.sh run it.
#   tools/deploy-smoke.sh <base url>
# Checks: /health 200 with db true; landing page; security headers (CSP with a script nonce, nosniff); the demo
# booking page and its API; one online booking in the demo salon (the demo salon returns the SMS code); demo
# manager login + /auth/me; /admin login + salon list. Env: ADMIN_PASSWORD (the /admin check; never printed),
# DEMO_MANAGER_PASSWORD (demo1234), DEMO_PHONE (+48500000001). Exit 1 on the first failure.
set -euo pipefail
BASE=${1:?usage: deploy-smoke.sh <base url>}
BASE=${BASE%/}
T=$(mktemp -d "${TMPDIR:-/tmp}/beauty-smoke.XXXXXX")
trap 'rm -rf "$T"' EXIT
n=0
ok() { n=$((n + 1)); echo "smoke: ok   $1"; }
fail() { echo "smoke: FAIL $1" >&2; exit 1; }
# req METHOD PATH [JSON] [cookie jar] -> body in $T/body, status in $code, headers in $T/head
req() {
  local args=(-sS --max-time 20 -o "$T/body" -D "$T/head" -w '%{http_code}' -X "$1")
  [ -n "${3:-}" ] && args+=(-H 'content-type: application/json' --data "$3")
  [ -n "${4:-}" ] && args+=(-b "$4" -c "$4")
  code=$(curl "${args[@]}" "$BASE$2") || code=000
}
hdr() { grep -i "^$1:" "$T/head" | head -1 | cut -d: -f2- | tr -d '\r' | sed 's/^ //'; }

req GET /health
[ "$code" = 200 ] && [ "$(jq -r .db "$T/body")" = true ] && ok "/health 200, db true" || fail "/health $code $(cat "$T/body")"

req GET /
[ "$code" = 200 ] && grep -q 'Załóż salon' "$T/body" && ok "landing page 200 with 'Załóż salon'" || fail "landing $code"
csp=$(hdr content-security-policy)
script=$(printf '%s' "$csp" | tr ';' '\n' | grep 'script-src' || true)
[[ "$script" == *"'nonce-"* && "$script" != *unsafe-inline* ]] && ok "CSP script-src has a nonce, no unsafe-inline" || fail "CSP: $csp"
[[ "$csp" == *"frame-ancestors 'none'"* ]] && ok "CSP frame-ancestors 'none'" || fail "CSP frame-ancestors: $csp"
[ "$(hdr x-content-type-options)" = nosniff ] && ok "x-content-type-options nosniff" || fail "nosniff missing"
[ -n "$(hdr referrer-policy)" ] && ok "referrer-policy $(hdr referrer-policy)" || fail "referrer-policy missing"
if [[ "$BASE" == https:* ]]; then [ -n "$(hdr strict-transport-security)" ] && ok "HSTS on https" || fail "HSTS missing"; fi

req GET /demo
[ "$code" = 200 ] && grep -q 'Salon Demo' "$T/body" && ok "/demo booking page 200" || fail "/demo $code"
req GET /api/demo
svc=$(jq -r '.services[0].id // empty' "$T/body")
[ "$code" = 200 ] && [ -n "$svc" ] && ok "/api/demo lists $(jq '.services | length' "$T/body") services" || fail "/api/demo $code"

req GET "/api/demo/availability?service=$svc&days=7"
cp "$T/body" "$T/slots"
count=$(jq '.slots | length' "$T/slots" 2>/dev/null || echo 0)
[ "$code" = 200 ] && [ "$count" -gt 0 ] && ok "availability: $count free starts" || fail "availability $code"
phone="+4860$(printf '%07d' $(( $(od -An -N4 -tu4 /dev/urandom | tr -d ' ') % 10000000 )))"
req POST /api/demo/booking/code "{\"phone\":\"$phone\"}"
bcode=$(jq -r '.code // empty' "$T/body")
[ "$code" = 200 ] && [ -n "$bcode" ] && ok "booking code (demo salon echoes it)" || fail "booking/code $code $(cat "$T/body")"
req POST /api/demo/booking/verify "{\"phone\":\"$phone\",\"code\":\"$bcode\"}"
ptok=$(jq -r '.phoneToken // empty' "$T/body")
[ "$code" = 200 ] && [ -n "$ptok" ] && ok "booking verify gives a phone token" || fail "booking/verify $code"
booked=""
for _ in 1 2 3 4 5; do
  i=$(( $(od -An -N2 -tu2 /dev/urandom | tr -d ' ') % count ))
  start=$(jq -r ".slots[$i].start" "$T/slots")
  req POST /api/demo/booking "{\"serviceId\":\"$svc\",\"start\":\"$start\",\"name\":\"Smoke Test\",\"phone\":\"$phone\",\"phoneToken\":\"$ptok\"}"
  [ "$code" = 200 ] && { booked=$(jq -r .visit.status "$T/body"); break; }
  [ "$code" = 409 ] || fail "booking $code $(cat "$T/body")"
done
[ -n "$booked" ] && ok "online booking at $start: status $booked" || fail "booking: every pick was taken"

jar=$T/panel.jar
req POST /api/demo/auth/login "{\"phone\":\"${DEMO_PHONE:-+48500000001}\",\"password\":\"${DEMO_MANAGER_PASSWORD:-demo1234}\"}" "$jar"
[ "$code" = 200 ] && ok "panel login (demo manager)" || fail "panel login $code $(cat "$T/body")"
if [[ "$BASE" == https:* ]]; then grep -qi '^set-cookie:.*secure' "$T/head" && ok "session cookie is Secure" || fail "session cookie not Secure"; fi
req GET /api/demo/auth/me "" "$jar"
[ "$code" = 200 ] && ok "panel session works (/auth/me)" || fail "/auth/me $code"

if [ -n "${ADMIN_PASSWORD:-}" ]; then
  ajar=$T/admin.jar
  req POST /api/admin/login "$(jq -cn --arg p "$ADMIN_PASSWORD" '{password: $p}')" "$ajar"
  [ "$code" = 200 ] && ok "/admin login" || fail "/admin login $code"
  req GET /api/admin/salons "" "$ajar"
  [ "$code" = 200 ] && ok "/admin salon list" || fail "/api/admin/salons $code"
else
  echo "smoke: skip /admin (ADMIN_PASSWORD not set)"
fi
echo "smoke: PASS $n checks on $BASE"
