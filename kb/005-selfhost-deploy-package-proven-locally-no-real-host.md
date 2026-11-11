# Deploy package and self-hosting proven locally, no real host called
Builds on: 001-exclude-constraint-race-gives-deadlock-40p01.md, 003-signup-approval-gate-and-pixel-matched-panel.md, 004-booking-page-sms-limits-and-reminder-sweep.md, #003, #004

## Verified by the supervisor
- `make check` exits 0. Vitest shows 12 files and 132 tests passed. `tools/test_deploy.sh` prints 22 ok lines and `test_deploy: PASS`.
- `make deploy-local` exits 0. Migrations 001 to 004 and the demo seed run from an empty volume.
- Smoke gives `PASS 16 checks` and browser smoke gives `PASS 4 checks`. Both run on 8152 (direct) and 8153 (Caddy).
- The cgroup memory.peak is about 113.5 MiB of 256 MiB. The supervisor measured 113,7. The command is in docs/deploy.md.
- /health gives 503 with the DB paused (3 s) and 503 with the DB stopped (0 s).
- `make selfhost-check` gives `PASS 14 checks`. The first salon is active, /admin/login is 404, and a second sign-up gets 403.
- No IP, host name or secret is in the repo. ssh, rsync, security and curl are PATH stubs in test_deploy.sh.

## Where things live
- deploy/Dockerfile and deploy/compose.yml: hosted stack, app on 127.0.0.1:${APP_PORT:-8150}.
- Root compose.yaml: self-host stack, port 8080, optional Caddy under profile `domain`. Dev DB is in compose.dev.yaml (port 55440).
- tools/deploy.sh (main session only), deploy-caddy.sh, caddy-remote.sh, backup.sh, restore.sh, deploy-local.sh, selfhost-check.sh.
- docs/deploy.md, README.md (Polish self-host section), CLAUDE.md (97 lines).
- SSH_TARGET, CADDYFILE and CADDY_CONTAINER come from env. They have no defaults.

## Gotchas
- `pg_restore --clean` fails on pg-boss partitioned tables ("cannot drop inherited constraint"). restore.sh loads into beauty_restore and renames the databases. The old data stays as beauty_before_restore.
- The Docker VM cannot mount $TMPDIR. Use `docker cp` for the local Caddyfile.
- `docker stats` is slow. Read cgroup memory.peak instead.
- Host ADMIN_PASSWORD is plain hex. The `$` signs in a scrypt hash break compose .env interpolation.
- Hosted compose sets ADDRESS_HEADER=X-Forwarded-For. A call that skips Caddy gets IP 'unknown' and shares one rate-limit bucket.
- Migrations only go forward. Rollback to beauty-app:prev needs the predeploy dump when the old image fails.

## Open threads
- The amd64 buildx path in tools/deploy.sh has only stub coverage. The first real `make deploy` runs it.
- The owner must run `make deploy`, set DNS for beauty.appnice.dev, and set up off-site backups.
- The wizard hardcodes beauty.appnice.dev in StepMain.svelte. The landing /demo link gives 404 when SEED_DEMO is off.
- .env.example holds placeholder secrets. The app does not refuse them. A start-time warning is a possible follow-up.
- Unverified: clientIp() change (`|| 'unknown'`) fixed the KB 004 UNDEFINED_VALUE issue. The worker saw 0 hits in one e2e run. The cause is a guess.
- Unverified by the supervisor: `make e2e` gave 17 passed.

## Lesson
- cue: A restore or reset step runs `pg_restore --clean` on a database that has extension-managed or partitioned tables, such as pg-boss.
- lesson: Load the dump into a new database, stop the app, then rename the databases. Keep the old one as a fallback. Do this in restore.sh.
- evidence: `pg_restore --clean` failed with "cannot drop inherited constraint queue_stats_...". The new restore.sh passed the round trip in `make deploy-local` ("restore brought the old salon name back").
- confidence: medium. One run showed the failure and the fix, and the supervisor saw the round trip pass.
