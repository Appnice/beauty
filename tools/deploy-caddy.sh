#!/usr/bin/env bash
# MAIN SESSION ONLY. Adds the beauty site block to the shared Caddy on the VPS, once (tools/deploy.sh runs it).
#
#   SSH_TARGET=... CADDYFILE=... CADDY_CONTAINER=... tools/deploy-caddy.sh
#   tools/deploy-caddy.sh --print [ADDRESS] [UPSTREAM]     print the site block only (no ssh); deploy-local uses it
#
# Env (no host defaults in the repo): SSH_TARGET, CADDYFILE (host path of the shared Caddyfile), CADDY_CONTAINER
# (the Caddy container name), optional CADDY_CHECK_SITES (space-separated URLs that must keep answering).
# DOMAIN (beauty.appnice.dev) and UPSTREAM (127.0.0.1:8150) have defaults. The remote part is
# tools/caddy-remote.sh: append once, backup, validate, reload, restore on failure. Reads no secret.
set -euo pipefail
cd "$(dirname "$0")/.."

DOMAIN=${DOMAIN:-beauty.appnice.dev}
UPSTREAM=${UPSTREAM:-127.0.0.1:8150}

site_block() { # $1 = site address, $2 = upstream
  printf '%s {\n\theader -Server\n\tencode zstd gzip\n\treverse_proxy %s\n}\n' "$1" "$2"
}

if [[ "${1:-}" == --print ]]; then
  site_block "${2:-$DOMAIN}" "${3:-$UPSTREAM}"
  exit 0
fi

: "${SSH_TARGET:?deploy-caddy: set SSH_TARGET}"
: "${CADDYFILE:?deploy-caddy: set CADDYFILE (host path of the shared Caddyfile)}"
: "${CADDY_CONTAINER:?deploy-caddy: set CADDY_CONTAINER (name of the Caddy container)}"
b64=$(site_block "$DOMAIN" "$UPSTREAM" | base64 | tr -d '\n')
ssh "$SSH_TARGET" bash -s -- "$DOMAIN" "$b64" "$CADDYFILE" "$CADDY_CONTAINER" "${CADDY_CHECK_SITES:-}" < tools/caddy-remote.sh
