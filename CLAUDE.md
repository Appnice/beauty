# beauty: free, open-source booking system for small salons

One SvelteKit 2 app (Svelte 5, TS, adapter-node) + PostgreSQL 16 + pg-boss (same DB). Spec (Polish, binding):
`~/appnice-apps/projects/beauty/RFC.md`. Hosted: https://beauty.vote2build.com (moved from beauty.appnice.dev 2026-11-12). Deploy + self-host: `docs/deploy.md`.

## Commands

| Command | What it does |
|---|---|
| `make db` / `make db-stop` / `make db-reset` | local Postgres 16 on 127.0.0.1:55440 (`compose.dev.yaml`, project `beauty-local`); reset drops data |
| `make migrate` | apply `migrations/NNN_*.sql` (runner: `src/lib/server/migrate.ts`, table `schema_migrations`) |
| `make seed` | (re)create the demo salon `/demo` (4 stylists, 10 services, visits this and next week) |
| `make dev` | dev server on http://localhost:8150 (migrates first) |
| `make check` | npm ci if needed + db + migrate + svelte-check + prettier/eslint + vitest + `tools/test_deploy.sh` (stubs) |
| `make e2e` | build + fresh DB `beauty_e2e` (`scripts/e2e-db.ts`) + headless Playwright: app on 8151, fake ntfy on 8159 |
| `make e2e-chain` | build + fresh DB + only `tests/e2e/chain.spec.ts`: the whole flow, sign-up to cancel, in one spec |
| `make deploy-local` | prod image + `deploy/compose.yml` (app 8152) + throwaway Caddy (8153), smokes, memory, 503, down -v |
| `make selfhost-check` | fresh repo copy, `cp .env.example .env && docker compose up` (8154), one active salon, down -v |
| `make deploy` / `make rollback` / `make deploy-caddy` | MAIN SESSION ONLY: need `SSH_TARGET`, `CADDYFILE`, `CADDY_CONTAINER` |
| `make test` / `make lint` / `make typecheck` / `make format` / `make build` | the single steps |
| `npx vitest run tests/<file>.test.ts` | one test file (needs `make db`) |

Tests use the database `beauty_test` on the same server; `tests/global-setup.ts` drops and recreates it.
Ports: dev 8150, tests/manual servers 8151-8159. Docker is shared: only projects `beauty-local`, `beauty-deploy-local`,
`beauty-selfhost-check`. Root `compose.yaml` = the self-host stack; `.env` is its file, dev settings go in `.env.dev`.

## Layout

- `migrations/` plain SQL, numbered; one transaction per file. Never edit an applied file: add a new one.
- `src/lib/server/` the core, no SvelteKit imports except `http.ts`:
  `availability.ts` (pure engine), `visits.ts` (lifecycle, DB loader), `booking.ts` (online flow),
  `auth.ts` (passwords, codes, sessions, rate limits, signed visit links), `policy.ts` (`can()`),
  `tenant.ts` (resolver, reserved slugs), `catalog.ts` (staff, services, schedules, hours), `clients.ts`,
  `blocks.ts`, `salons.ts` (create, sign-up, settings), `seed.ts` (demo + prune), `queue.ts` (pg-boss),
  `jobs.ts` (handlers + workers), `notify.ts` (every SMS = a `notification` row), `sms/` (adapter: `log`, `smsapi`),
  `approval.ts` (admin notice, accept/reject, 30-day purge, audit), `admin.ts` (ADMIN_PASSWORD login, own cookie),
  `sms/templates.ts` (every SMS text: `T.*`, `gsm()`, `fit()` to 160 chars).
- Client side (SSR): `/[salon]` booking steps (`src/lib/booking/`, `?krok=usluga|osoba|termin|dane|kod|gotowe`,
  state in sessionStorage), `/[salon]/wizyta/[token]` visit page (cancel = form action), `/[salon]/prywatnosc`,
  `/w/[token]` short SMS link (302; a bad token = bare 404). Booking API: `booking/code` -> `booking/verify`
  (phoneToken, 30 min) -> `booking`; a 409 carries the phoneToken, so a taken time needs no new code.
- Pages: `/` landing, `/zaloz` wizard (`src/lib/signup/`: one `$state` object mirrored to sessionStorage, step in
  `?krok=N`), `/login`, `/admin` (+`/admin/login`), `/[salon]` public page, `/[salon]/panel` (+ `tydzien`,
  `czekaja`, `ustawienia/{uslugi,zespol,godziny,blokady,link}`). Panel + admin + wizard: `ssr = false` (dates
  come from the browser clock). Panel parts in `src/lib/panel/` (DayGrid 64 px/hour, sheets, rail, stylist view),
  shared UI in `src/lib/ui/`, tokens in `src/app.css`, person colours in `src/lib/colors.ts`, Polish words/dates
  in `src/lib/pl.ts`. One panel data call: `GET /api/<salon>/calendar?date&days`.
- `src/routes/api/[salon]/...` thin JSON routes over the services (`api()` / `staffApi()` in `http.ts`).
  `src/routes/api/signup`, `src/routes/health`. Route files may export only HTTP methods: schemas live in `schemas.ts`.
- `src/hooks.server.ts` runs migrations on start (`MIGRATE_ON_START=off` skips), seeds the demo salon (`SEED_DEMO=on`),
  starts workers (`JOBS=off` skips) and adds security headers (`headers.ts`). CSP = `kit.csp` in `svelte.config.js`.
- `deploy/` Dockerfile + hosted compose; `tools/deploy*.sh`, `caddy-remote.sh`, `backup.sh`, `restore.sh`, smokes.
- `tests/` Vitest. `helpers.ts` has `call()` (a fake RequestEvent that runs a real route handler), `makeSalon()`.
- `tests/e2e/*.spec.ts` Playwright, one worker, one DB: each spec cleans what it needs (`helpers.ts`).
  `screens.spec.ts` renders `docs/design/*.dc.html` with the local `docs/design/support.js` and checks the copy.
- `docs/design/` = copy of the approved design (`projects/beauty/design/`); `tools/side-by-side.html` shows pairs.

## Conventions

- Every table has `salon_id`; foreign keys are composite `(salon_id, id)`, so no row can point into another salon.
  Every query filters by `salon_id`. A session resolves only inside its own salon (`actorFromToken`).
- Double booking guard: `visit_no_overlap` EXCLUDE on `(staff_id, during)` for active visits;
  `during = [starts_at, blocked_until)` where `blocked_until = end + service buffer`. 23P01 -> `TERM_TAKEN`.
  Concurrent conflicting inserts can deadlock (40P01): `retryDeadlock()` retries, then 23P01 wins.
- Status codes are ASCII: `oczekuje`, `potwierdzona`, `odwolana`, `nieobecnosc`, `zakonczona`. UI shows them with diacritics.
- Time: DB in UTC (`TimeZone=UTC` on the connection), salon zone `Europe/Warsaw`, built-in `Temporal` (Node 26).
  postgres.js v4 sends params untyped: pass ISO strings with `::timestamptz` casts.
- Money in grosze (int). Phones in E.164 via `normalizePhone()` (+48 default).
- All user-facing text is Polish, plain words (wizyta, termin, grafik), correct diacritics. Errors: `AppError(code, pl message)`.
- Server code imports with explicit `.ts` extensions, so `node scripts/*.ts` runs it without a build step.
- Online visits must match a start the engine offers; reception visits only hit the DB guard.
- Jobs re-read the visit and skip stale work (cancelled, moved, decided: `status` in the job data); queued jobs are
  never cancelled. Reminders (day before, manager after X h) come only from the `sms-sweep` cron
  (`sweepReminders(sql, clock)`, every 10 min, quiet 21:00-8:00); the unique index `notification_once` makes each
  go out once. `sendSms` checks `SMS_MONTHLY_LIMIT`: codes refuse, other SMS get status `limit` and are not sent.
- SMS texts: no diacritics, max 160 GSM chars, links `${PUBLIC_URL}/w/<token>`. Add a text in `templates.ts` and
  in `tests/sms-templates.test.ts`.
- RODO erase (`deleteClient`) keeps the client row and visits (name '', phone null, `erased_at`); views show
  `ERASED_NAME` ("Usunięty klient"); `listClients` skips erased rows.
- Salon status: `pending` (hosted sign-up) / `active` / `rejected`. `clientSmsAllowed(salon)` gates client SMS
  (jobs) and online booking; a rejected salon cannot log in. Anti-spam order in `signup()`: honeypot, invite
  code, phone token, one salon per phone, 3 per IP a day, 30 pending in total.
- UI copy is the design's copy word for word; no help texts. Touch targets 44 px, main buttons 56 px.

## Gotchas

- Never run the SMSAPI provider for real: it is used only with `SMS_PROVIDER=smsapi` + `SMSAPI_TOKEN`. Tests inject a fake fetch.
- Demo salon (`is_demo`) and `SMS_ECHO=on` return verification codes in the API response (no gateway needed).
- adapter-node reports `https:` by default; the cookie `Secure` flag follows `PUBLIC_URL`. Compose sets `ORIGIN`.
- CSP: script-src is nonce-only. Never add an inline `<script>` or `on*=` attribute in app.html; styles may be inline.
- The Docker VM on this Mac cannot bind-mount `$TMPDIR`: `docker cp` a file into a container instead.
- No GitHub Actions, no deploy from here; the main session commits (never `git add -A`).
- A button inside a `<form>` without `type="button"` submits it: Enter in a field then "clicks" the first one.
- Design `.dc.html` boxes are content-box (a 64 px row + border = 67 px); the app is border-box.
- e2e cookies: `PUBLIC_URL=https://...` makes them `Secure`; Chromium still accepts them on http://localhost.
- Compare instants by epoch, not by string: the API sends `...:00Z`, a JS Date gives `...:00.000Z`.
- e2e phone bases must differ per spec: one salon per phone (`salon_phone_once`) also binds `makeActiveSalon()`.
- A job run inside a Playwright spec (e.g. `sweepReminders`) signs links with the test process env: set `APP_SECRET`
  and `PUBLIC_URL` from `E2E_ENV` first, or the SMS link is a 404 on the server (`chain.spec.ts`).
