# Deploy and self-hosting

Two compose files use one image (`deploy/Dockerfile`):

| File | For | App | Database |
|---|---|---|---|
| `deploy/compose.yml` | the hosted instance https://beauty.appnice.dev (project `beauty`, `/opt/beauty` on the VPS) | `127.0.0.1:8150`, 256m, many salons with approval, demo salon | Postgres 16.15, 256m, no published port, volume `beauty_beauty-db` |
| `compose.yaml` (repo root) | self-hosters: `cp .env.example .env && docker compose up -d` | `127.0.0.1:${PORT:-8080}`, 256m, `SINGLE_SALON=on` | same, password from `POSTGRES_PASSWORD` |
| `compose.dev.yaml` | development only (`make db`) | none | `127.0.0.1:55440`, project `beauty-local` |

## Image

`deploy/Dockerfile`: three stages on `node:26.11.1-slim` (Node 26: built-in Temporal). `build` runs `npm ci` and
`vite build`; `deps` installs the production dependencies only; `run` holds `build/`, `migrations/`,
`node_modules` and `package.json`, runs as `USER node` with `NODE_ENV=production` and `PORT=3000`. The healthcheck
uses Node's `fetch` (slim has no curl). Image size: 90 MB (`docker image inspect`, printed by `make deploy-local`).

At start the app applies the migrations (`MIGRATE_ON_START`, default on). `SEED_DEMO=on` creates the demo salon
when it is missing; the hourly demo job keeps it fresh.

## Behind the proxy

- `ORIGIN=$PUBLIC_URL`, `PROTOCOL_HEADER=x-forwarded-proto`, `ADDRESS_HEADER=X-Forwarded-For`, `XFF_DEPTH=1`:
  the app takes the last X-Forwarded-For hop, which Caddy writes. The rate limits then count per client IP.
  `make deploy-local` checks it: through Caddy the app sees the client IP, direct requests show `unknown`.
- Cookies: `Secure` when `PUBLIC_URL` is https (session `httpOnly`, `sameSite=lax`; admin `sameSite=strict`).
- Headers (`src/hooks.server.ts`, `src/lib/server/headers.ts`): `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Frame-Options: DENY`, and
  `Strict-Transport-Security` only when `PUBLIC_URL` is https.
- CSP (`kit.csp` in `svelte.config.js`, mode `auto`): `script-src 'self' 'nonce-…'` (SvelteKit puts the nonce
  on its boot script, also on the `ssr = false` pages), `style-src 'self' 'unsafe-inline'` (the design uses
  inline style attributes, which a nonce cannot cover), `default-src`, `connect-src`, `font-src`, `base-uri`,
  `form-action 'self'`, `img-src 'self' data:`, `frame-ancestors 'none'`, `object-src 'none'`.
- `/health`: 200 `{"ok":true,"db":true}` when the database answers within 3 s, else 503 (`connect_timeout` 3 s
  in `db.ts`). A stopped database gives 503 at once, a paused one after 3 s.

## Hosted deploy (main session only)

```sh
SSH_TARGET=<user@host> CADDYFILE=<host path of the shared Caddyfile> CADDY_CONTAINER=<caddy container> make deploy
```

No host name, IP or path of the VPS is in the repo: they come from the environment. `tools/deploy.sh`:

1. Builds the image on the Mac with `docker buildx --platform linux/amd64` and ships `docker save | gzip`.
   Why on the Mac: the shared VPS has little RAM, a vite build there would starve the other apps, and the host
   then needs no Node, npm or source code.
2. Precheck on the host: port 8150 free or ours, at least 400 MB available.
3. rsync `compose.yml`, `backup.sh`, `restore.sh` and the image tar to `/opt/beauty`.
4. Backup first: `backup.sh` (pg_dump, tag `predeploy`) and `beauty-app:latest` tagged as `beauty-app:prev`;
   then `docker load`. It installs the nightly backup cron line (03:17, replaced on every deploy).
5. Writes `/opt/beauty/.env` when it is missing (or with `SECRETS=1`) from the Keychain, over ssh stdin with
   `umask 077`; values are never printed. Generated when missing: `beauty-db-password`, `beauty-app-secret`,
   `beauty-admin-password`. Passed when they exist: `beauty-admin-phone`, `beauty-admin-notify-url`,
   `beauty-signup-code`, `beauty-smsapi-token`. The SMS provider stays `log`. `OPERATOR_NAME` (the legal name
   and address on the privacy page; not a secret) comes from env `OPERATOR_NAME`, else from the Keychain item
   `beauty-operator-name`. When neither is set, the script prints a warning and the page shows
   'operator tego serwera'.
6. `docker compose -p beauty up -d`, waits for the healthcheck, prints `docker stats`.
7. `tools/deploy-caddy.sh`: appends the `beauty.appnice.dev` site block to the shared Caddyfile once (an awk
   check), with a backup, `caddy validate` then `caddy reload`, and restores the backup when validate or reload
   fails or a site in `CADDY_CHECK_SITES` stops answering. `tools/deploy-caddy.sh --print` prints the block.
8. Smokes against `https://beauty.appnice.dev`: `tools/deploy-smoke.sh` and `tools/deploy-browser-smoke.ts`.

`make rollback` puts `beauty-app:prev` back. A migration of the newer image stays in the database; when the old
image cannot run on it, restore the `predeploy` dump with `restore.sh`.

## Backups

- `tools/backup.sh`: `pg_dump -Fc` inside the database container into `/opt/beauty/backups`, removes dumps older
  than 14 days (`KEEP_DAYS`). Nightly from cron and before every deploy.
- `tools/restore.sh <file.dump>`: loads the dump into a new database first (the live data stays when the load
  fails), stops the app, swaps the databases (the old one stays as `beauty_before_restore`), starts the app and
  waits for health. A plain `pg_restore --clean` fails on the pg-boss partitioned tables.
- Off-site copies: not done yet (owner action: pull the dumps to another machine, encrypted).

## Local proof

| Command | What it proves |
|---|---|
| `make deploy-local` | the production image builds; `deploy/compose.yml` starts from an empty volume (project `beauty-deploy-local`, app 8152); migrations and the demo seed run; `deploy-smoke.sh` (16 checks) and the browser smoke (4 checks) pass directly and through a throwaway Caddy on 8153 with the `--print` block; app memory under the cap; client IP through the proxy; backup + restore round trip; `/health` 503 with the db paused and stopped, 200 after; then `down -v` |
| `make selfhost-check` | a fresh copy of the repo in a temp dir, `cp .env.example .env`, `docker compose up -d` (port 8154): the first-run sign-up creates the salon as `active`, `/admin` is 404, a second sign-up is refused (403); then `down -v` |
| `make check` | includes `tools/test_deploy.sh`: deploy, Caddy, rollback and backup scripts with PATH stubs for ssh, rsync, security, docker and curl; no secret in any output; a failed validate restores the Caddyfile; a second run adds no second block; no IP in the deploy files |

## Memory (S4 criterion C4)

Measured on 2026-11-11 with `make deploy-local` (macOS, Docker VM arm64, after both HTTP smokes and both browser
smokes). The command reads the app container's cgroup peak, which is what the 256m cap counts:

```sh
docker exec beauty-deploy-local-app-1 cat /sys/fs/cgroup/memory.peak    # -> 113.5 MiB (memory.max 256 MiB)
docker stats --no-stream --format '{{.Name}} {{.MemUsage}}' beauty-deploy-local-app-1 beauty-deploy-local-db-1
# -> app 111.8MiB / 256MiB, db 46.75MiB / 256MiB
```

Three runs gave a peak of 113.4, 113.7 and 113.5 MiB. `NODE_OPTIONS=--max-old-space-size=160` keeps the heap
below the cap. The VPS is linux/amd64; its numbers can differ a little.

## Owner actions (not done by the harness)

- Run `make deploy` with `SSH_TARGET`, `CADDYFILE` and `CADDY_CONTAINER`; DNS for `beauty.appnice.dev`.
- Add the Keychain items `beauty-admin-phone` and `beauty-admin-notify-url` (optional) before the first deploy.
- Add the Keychain item `beauty-operator-name` (legal name and address of the operator) before the first deploy.
  Without it the privacy page shows 'operator tego serwera'. On a later change: `SECRETS=1 make deploy`.
- Off-site backup copies.
