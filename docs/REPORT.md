# beauty: end-to-end check and report (task #006, revised by task #007)

## Answer to Patryk's question

> zakladanie konta jest per telefon? nie zaspamuja mi serwera? niech bedzie jakis approve z mojej strony...

Yes. The app ties each salon to one phone number:
- **One salon per phone.** The partial unique index `salon_phone_once on salon (phone) where not is_demo and phone is not null` (migrations/003_approval.sql:16) refuses a second salon.
- **The owner types an SMS code first.** The code has limits per phone and per IP.
- **Other limits:**
  - at most 3 sign-ups per IP per day
  - at most 30 pending salons in total, then the wizard shows "Dużo zgłoszeń. Spróbuj jutro."
  - a hidden honeypot field
  - an optional invite code (`SIGNUP_CODE`)
- **You approve each salon.** After the phone code, the wizard asks for "O salonie": city, street, people, link and description. Then come services, team and hours, and the last button is "Wyślij do akceptacji".
- **A pending salon gets no online booking, sends no client SMS and shows nowhere public.**
- **How you learn about a new salon.** The ntfy POST is the only real notice, and it goes out only when you set `ADMIN_NOTIFY_URL` (src/lib/server/approval.ts:35-45). The SMS to ADMIN_PHONE uses the `log` provider, so no SMS reaches your phone. The app only writes a DB row and a log line.
- **You decide at `/admin`.** You accept or reject every salon there.

The chain test below runs this whole path.

## Disputes for the owner (no task was opened)

1. **Operator name on the privacy page and in docs/umowa-powierzenia.md.** The variable is `OPERATOR_NAME` (src/routes/[salon]/prywatnosc/+page.server.ts:18, compose.yaml:39, deploy/compose.yml:39, .env.example:21, README.md:112). Its default is 'operator tego serwera'. The privacy page always shows it (+page.svelte:25: 'System zapisów utrzymuje {data.operator}.'), and nothing hides the section. The legal name and address for beauty.appnice.dev do not exist yet. Task #007 adds `OPERATOR_NAME` to `tools/deploy.sh`: it takes env `OPERATOR_NAME`, else the Keychain item `beauty-operator-name`. When neither exists, the script prints a warning and the page shows 'operator tego serwera'. Criterion: S2.C7. Evidence: #004, #007.
2. **The landing page says "Otwarty kod". Can it link to GitHub?** The repo is private and the licence (MIT or AGPL) is still open, so the page has no link now. Criterion: S2.C8. Evidence: #004.

## Criteria of the run

| Criterion | Result | Evidence (task #006 unless noted) |
|---|---|---|
| S1.C1 to S1.C7 | pass | `make e2e` exit 0, "18 passed (58.8s)": signup, admin, calendar, pending-stylist, screens specs. `make check` exit 0. |
| S2.C1 to S2.C8 | pass | Same `make e2e` (booking and booking-screens specs). `make check` "Tests 132 passed (132)" includes sms-templates, reminders and booking-flow. |
| S3.C1 | pass | `make deploy-local` exit 0: "smoke: PASS 16 checks" on 8152 and 8153, "browser-smoke: PASS 4 checks" on both. |
| S3.C2 | pass | `make selfhost-check` exit 0: "selfhost: PASS 14 checks", then down -v. |
| S3.C3 | pass | Task #007 `make check`: 23 "test_deploy: ok" lines (22 before, plus the new OPERATOR_NAME check), "test_deploy: PASS". |
| S3.C4 | pass | "cgroup memory.peak 113,5 MiB, memory.max 256 MiB". docs/deploy.md has the command. |
| S3.C5 | pass | Only local commands ran (list below). test_deploy prints "ok no IP address in deploy/, tools/*.sh, compose files, .env.example, docs/deploy.md". |
| S3.C6 | pass | "/health with the db stopped: 503 {"ok":false,"db":false} in 0 s" and "with the db started again: 200". |
| S4.C1 | pass | `make e2e-chain` 2 times in a row on a fresh DB: "1 passed (16.3s)" and "1 passed (16.4s)". |
| S4.C2 | pass (worker claim) | The #006 worker ran `make check`, `make e2e` and `make deploy-local` from a clean install (`rm -rf node_modules build .svelte-kit`), all exit 0. kb/006 says the supervisor did not run the clean install again, so nobody checked it independently. |
| S4.C3 | pass | This report. |
| S4.C4 | pass | "no listener 8150-8159", "no browser", and no beauty-deploy-local or selfhost container. beauty-local-db-1 ran before task #006. |

## The chain spec (`make e2e-chain`, tests/e2e/chain.spec.ts)

`make e2e-chain` = build + `scripts/e2e-db.ts` (fresh `beauty_e2e`) + `npx playwright test tests/e2e/chain.spec.ts`. The salon is open 7 days: the wizard default plus Sunday, switched on in the hours step. So "tomorrow" and "the day after" are open days on any run date. The steps in one test:

1. **Sign-up at 390 px.** The owner fills "Studio Marta", the phone and the password ("1 z 6"), then the echo SMS code, then "O salonie" (Legnica, Złotoryjska 40, 2–3, link, description). Services keep the defaults; team is Marta + Kasia; hours add Sunday. The owner presses "Wyślij do akceptacji" and sees "Sprawdzamy salon". DB: `pending`, opening hours weekdays 1 to 7.
2. **Booking page of the pending salon.** It shows the name, "Zapisy online wkrótce" and no services.
3. **Admin at 1280 px.** The admin logs in at `/admin`. The card shows "Legnica · Złotoryjska 40" and the description. "Akceptuj" sets the salon `active`. The fake ntfy server got exactly 1 "Nowy salon: Studio Marta, Legnica." POST.
4. **Owner on the 1024 px tablet.** She logs in with the password. In Ustawienia, Zespół, she gives Kasia a phone. Then she picks "Czekają na mnie" (DB `confirmation_mode = manual`) and opens Kalendarz. There is no badge.
5. **Client 1 at 390 px.** She books Strzyżenie damskie with Kasia, tomorrow 9:00, with the echo code, and sees "Czeka na potwierdzenie salonu". DB: `oczekuje`, `online`.
6. **Waiting list.** The badge shows "1" without a reload. In "Czekają", "Przyjmij" sets the visit `potwierdzona` and the badge goes away. The job queue writes the `potwierdzenie` SMS.
7. **Stylist Kasia at 390 px.** She logs in with an SMS code. She has no Menu nav. Under "Jutro" she sees 1 visit (Natalia Bąk) and the page has no horizontal scroll.
8. **Phone visit and the taken time.**
   - Client 2 fills the form for Marta, the day after tomorrow at 9:00, and stops on the code step.
   - The owner taps Marta's 9:00 and sees "+ Dodaj wizytę". The side sheet has Marta prefilled. She enters the phone, the name and the service chip, then presses "Zapisz · 9:00–10:00". DB: `recepcja`, `potwierdzona`.
   - Client 2 presses "Zarezerwuj" and gets "Ten termin jest już zajęty" on "Kiedy?".
9. **Reminder.** `sweepReminders` runs with the clock at today 18:00 Warsaw and returns `reminders: 1`. A second sweep returns 0. There is exactly 1 `przypomnienie` row: client 1's visit, +48700900101, "Studio Marta: jutro czw. 12.11 o 09:00, Strzyzenie damskie. Odwolanie: https://beauty.appnice.dev/w/...".
10. **Cancel from the SMS link.** Client 1 opens the reminder link and sees "Wizyta potwierdzona". She uses "Odwołaj wizytę" and "Tak, odwołaj", and sees "Wizyta odwołana". DB: `odwolana`, `klient`. The availability API offers tomorrow 9:00 for Kasia again.
11. **SMS counter.** Ustawienia shows "8 z 300", which equals the 8 SMS notification rows of the salon: `admin_nowy_salon, salon_przyjety, kod_klient, oczekuje, potwierdzenie, kod_logowania, kod_klient, przypomnienie`.

**The fix in task #006 (test only).** At first the reminder link gave "Nie znaleziono wizyty.". The sweep ran in the Playwright process, which signed the link with another APP_SECRET. The spec now sets `APP_SECRET` and `PUBLIC_URL` from `E2E_ENV` before the sweep. The server cron uses the server env, so the app needs no change.

## Changes in task #007

- `tools/deploy.sh` writes `OPERATOR_NAME='<value>'` into `/opt/beauty/.env`. The value comes from env `OPERATOR_NAME`, else from the Keychain item `beauty-operator-name`.
- The script refuses a value with a single quote or a new line, because these break the compose .env.
- The script prints only "operator name: set" or "none", and a warning when it has no value.
- `tools/test_deploy.sh` puts `FAKE Operator sp. z o.o., ul. Testowa 1` in the Keychain stub. It checks the .env key list and the quoted line. The leak check also covers this value.
- `docker compose config` on a scratch copy of `deploy/compose.yml` resolves the quoted line to `OPERATOR_NAME: FAKE Operator sp. z o.o., ul. Testowa 1`. This command starts no container.
- `docs/deploy.md` names the source of `OPERATOR_NAME` in deploy step 5 and adds `beauty-operator-name` to the owner actions.
- `README.md`: I reflowed two English lines to the line width of the rest of the file.

## Commands that ran (all local, no host contacted)

Task #006:

```
rm -rf node_modules build .svelte-kit && make build     -> npm ci, '✔ done'
make e2e-chain   (run 1)  -> exit 0, '1 passed (16.3s)'
make e2e-chain   (run 2)  -> exit 0, '1 passed (16.4s)'
make check                -> exit 0, 'COMPLETED 754 FILES 0 ERRORS 0 WARNINGS', 'Test Files  12 passed (12)', 'Tests  132 passed (132)', 22 x 'test_deploy: ok', 'test_deploy: PASS'
make e2e                  -> exit 0, '18 passed (58.8s)'   (17 earlier specs + chain); 0 'UNDEFINED' lines in the log
make deploy-local         -> exit 0, 'smoke: PASS 16 checks' x2, 'browser-smoke: PASS 4 checks' x2, 'memory.peak 113,5 MiB, memory.max 256 MiB', 'deploy-local: PASS', 'stack removed (down -v), exit 0'
make selfhost-check       -> exit 0, 'selfhost: PASS 14 checks', 'stack and copy removed (down -v), exit 0'
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':815[0-9]'   -> none
pgrep -fl 'playwright|chrome-headless|headless_shell' -> none
```

Task #007:

```
docker compose -p envq-check -f compose.yml config | grep OPERATOR   -> '      OPERATOR_NAME: FAKE Operator sp. z o.o., ul. Testowa 1'
make check   -> exit 0, 'COMPLETED 754 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS', 'Test Files  12 passed (12)', 'Tests  132 passed (132)', 23 x 'test_deploy: ok', 'test_deploy: PASS'
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':815[0-9]'   -> none
docker ps --format '{{.Names}}' | grep beauty       -> beauty-local-db-1
```

No ssh, rsync, DNS or Caddy call went to a real host. There was no SMSAPI call, no real ntfy call and no paid call (spend 0).

## RFC MVP items against the build

| RFC item | Status | Note |
|---|---|---|
| 1. Reception panel: day view, one column per person | built | Kalendarz, 64 px/hour, person colours, "now" line, hatched blocks |
| 1. Week view | built | `/panel/tydzien` (screenshot Tydzien.png) |
| 1. Add a visit in two taps (phone visit) | built | Tap, "+ Dodaj wizytę", side sheet. The chain spec and calendar.spec cover it. |
| 1. Drag and drop, cancel | built | calendar.spec: a move to another person, a refused drop, cancel |
| 1. Waiting list | built | "Czekają na Ciebie" with a badge that updates without a reload |
| 2. Client booking page: service, person or "Obojętnie", only fitting times, name + phone, SMS code, no account | built | Uses a path `/<slug>`, not the RFC's subdomain (a decision) |
| 3. Confirmation mode auto/manual + manager reminder after X h | built | Ustawienia radio; the sweep sends `menadzerka` once |
| 4. SMS: confirmation, day-before reminder, cancel link, cancel frees the time | built | The tests prove only the `log` provider. The app never calls SMSAPI, and no real gateway exists. |
| Configuration: services with time and price, staff with services, hours, holidays and breaks | partly | All of these exist. No panel field for the buffer, the price visibility (`show_prices` is API only) or the cancel cut-off (DB only). |
| Stylist: own day today/tomorrow, own blocks, read-only | built | Stylist phone view. She sees no client phone (owner decides). |
| Client: cancel from the SMS link | built | `/w/<token>`; a changed token gives a 404 |
| Double booking guard in the DB | built | EXCLUDE `visit_no_overlap` + retry on 40P01 |
| Multi-tenancy by `salon_id` | built | Composite FKs. Row Level Security ("docelowo" in the RFC) is not built. |
| RODO: data processing agreement, privacy page, erase on request | partly | The page and the erase work. docs/umowa-powierzenia.md needs a lawyer and the operator name. |
| PWA | partly | manifest + icons; no service worker or offline mode |
| One `docker compose up` self-host | built | `make selfhost-check` PASS 14 |
| Caddy with automatic HTTPS | partly | Stubs and a local Caddy on 8153 test the site block script. The local Caddy cannot prove automatic HTTPS, because that needs a real domain. No test covers the self-host `--profile domain` path. HTTPS itself is unproven. |
| Encrypted backups | partly | Nightly pg_dump with 14 days kept and a restore round trip. No encryption, no off-site copy. |
| Salon approval (Patryk's rule) | built | pending/active/rejected, /admin, audit, 30-day purge, anti-spam limits |

## Design screens against the build

| Design file | Status | Screenshot |
|---|---|---|
| Main.dc.html (1 z 6) | built (byte-identical) | docs/screens/Main.png |
| Kod.dc.html | built (byte-identical) | Kod.png |
| Salon.dc.html (O salonie) | built (byte-identical) | Salon.png |
| Uslugi.dc.html | built (#003: 0.03 % pixel diff, checkbox edges) | Uslugi.png |
| Zespol.dc.html | built (byte-identical) | Zespol.png |
| Godziny.dc.html | built (byte-identical) | Godziny.png |
| Gotowe.dc.html (Sprawdzamy salon) | built (byte-identical) | Gotowe.png |
| Kalendarz.dc.html | built (#003: 0.00 %, 2 pixels) | Kalendarz.png, Kalendarz-390.png, Kalendarz-1440.png |
| NowaWizyta.dc.html | built (#003: 0.00 %) | NowaWizyta.png |
| Czekaja.dc.html | built (byte-identical) | Czekaja.png |
| Ustawienia.dc.html | built (#003: 0.09 %; the app adds "Wyloguj się") | Ustawienia.png |
| Admin.dc.html | built (byte-identical) | Admin.png |
| Screens with no design | built in the same look | Tydzien, Login, Login-kod, Stylistka, Ustawienia-zespol, Ustawienia-link, Klient-0..8 at 390 and 1440 px |

`make e2e` rewrote the screenshots: screens.spec.ts:53/83 and booking-screens.spec.ts:55 write docs/screens/*.png on every run. `cmp` of docs/screens/design/*.png against docs/screens/*.png shows the same 8 byte-identical pairs. Only Kalendarz, NowaWizyta, Uslugi and Ustawienia differ.

No repo command produces the pixel percentages. They come from the #003 worker. The editor ran a per-channel compare with threshold 25 in headless Chromium and got close values:
- Kalendarz: 2 pixels over the threshold.
- Uslugi: 0.022 %.
- Ustawienia: 0.086 %.
- NowaWizyta: 0 pixels over the threshold, but 23 % of its pixels differ by 25 levels or less.

## Gaps and risks

- **No real SMS gateway.** The hosted instance sends nothing until the owner picks a provider and sets `SMS_PROVIDER=smsapi` + `SMSAPI_TOKEN`. Until then the app only logs every SMS, codes too. A real client cannot verify a phone unless SMS_ECHO is on, and SMS_ECHO must stay off in production.
- **Client IP behind Caddy.** The hosted compose sets `ADDRESS_HEADER=X-Forwarded-For` (#005), and `make deploy-local` checks the IP through Caddy. A request that skips Caddy gets IP `unknown` and shares one rate-limit bucket.
- **amd64 image build.** The linux/amd64 buildx path ran only in the stub test. The first `make deploy` is its first real run.
- **Confirmation SMS race (seen once, not reproduced).** In the first #006 chain run, the queued `potwierdzenie` job stayed `created`. The client cancelled soon after the owner accepted, so the job skipped and no "confirmed" SMS went out. No command measured the time window, and kb/006 marks this as one unverified worker observation.
- **Reception visits get no confirmation SMS.** They get only the day-before reminder.
- **No backup encryption, no off-site copy.**
- **CLAUDE.md is at 100 of 100 lines.**

## For the owner to read (findings with no criterion; not worked on)

- **S4 deploy must set the client IP header behind Caddy (#003).** The hosted compose now sets ADDRESS_HEADER and XFF_DEPTH (#005), and deploy-local checks it. Keep these settings on the VPS.
- **Owner pages on a stylist session.** They answer 200 with the error page, because the panel renders in the browser. The API stays 403.
- **UNDEFINED_VALUE in e2e (#003, #004).** It gave 0 hits in the #006 `make e2e` log. This agrees with the #005 `clientIp() || 'unknown'` change, but nobody proved the cause.
- **Self-host shows the hosted domain.** The wizard on a self-host install shows `beauty.appnice.dev/<slug>`, and the landing /demo link gives a 404 when SEED_DEMO is off.
- **Placeholder secrets in .env.example.** The app accepts them as they are. A public self-host install needs a real APP_SECRET and POSTGRES_PASSWORD.

## Owner actions

- **Stray process.** Kill the old `node build` process: PID 4055, cwd repos/beauty, started śr. 11 lis 18:35:32 2026.
- **Operator name.** Give the legal name and address of the operator, and store it in the Keychain item `beauty-operator-name` before the first deploy.
- **Stylist sees the client phone?** Decide if a stylist sees the client's phone. Now she does not.
- **Late bookings and the reminder.** Decide if a visit booked after 21:00 for the next morning gets a reminder. Now it does not, because reminders go out 17:00 to 20:59 only.
- **Accents in SMS.** `gsm()` keeps GSM accents (é, ü, ö, ä, ñ, ß). Decide if a strict strip is necessary.
- **Booking limit per phone.** The 3-bookings-per-phone-per-24h rule counts online visits, and a cancelled one still counts. It does not use `rateLimit`. Record or change this.
- **First real amd64 build.** The first real `make deploy` is also the first run of the amd64 buildx path.
- **Licence.** Choose MIT or AGPL, and decide when the repo goes public.
- **SMS gateway and price.** Pick a real SMS gateway and the hosted price.

## RFC open questions for the owner

- Is the pilot salon a franchise? If so, who decides on the booking system?
- How many no-shows are there in a typical week, and how does the salon handle them today?
- Do the stylists need their schedule on the phone, or is the reception tablet enough? The build has the phone view, so the answer decides only if it is switched on.
- Do prices show on the booking page? The wizard default hides them, and no panel toggle exists yet.
- Licence: MIT or AGPL?
- Project name. The domain is `beauty.appnice.dev` (decided).
- New, from the build:
  - the operator name for the privacy page and the agreement
  - the GitHub link on the landing page
  - the client phone in the stylist view
  - a reminder for visits booked after 21:00

## Paths to commit (`git status --porcelain` in repos/beauty)

Every path is untracked. The repo has no commits yet:

```
?? .dockerignore
?? .env.example
?? .gitignore
?? .prettierignore
?? .prettierrc
?? CLAUDE.md
?? Makefile
?? README.md
?? compose.dev.yaml
?? compose.yaml
?? deploy/
?? docs/
?? eslint.config.js
?? kb/
?? migrations/
?? package-lock.json
?? package.json
?? playwright.config.ts
?? scripts/
?? src/
?? static/
?? svelte.config.js
?? tests/
?? tools/
?? tsconfig.json
?? vite.config.ts
```

Task #007 changed files inside these paths: `tools/deploy.sh`, `tools/test_deploy.sh`, `docs/deploy.md`, `README.md`.

`.gitignore` already excludes `node_modules/`, `/build/`, `/.svelte-kit/`, `.env`, `.env.*` (but keeps `.env.example`), `/test-results/`, `/playwright-report/` and `*.log`. Commit these paths explicitly, never `git add -A`. Also commit `projects/beauty/STATE.md` in the workspace. The GitHub repo `appnice/beauty` does not exist yet. The commit author must be `developer@appnice.dev`.

## Deploy steps for the main session (beauty.appnice.dev)

Only the main session runs these steps. Patryk must say yes in that session first.

1. **Pre-checks.**
   - Check free disk and memory on the Mac.
   - Make sure no other build runs in repos/beauty.
   - Kill the stray PID 4055.
2. **Keychain items.**
   - `beauty-admin-password` (ADMIN_PASSWORD): `tools/deploy.sh` generates it when it is missing. To choose it yourself: `security add-generic-password -a "$USER" -s beauty-admin-password -w` (it asks for the value; do not put it on the command line). Use plain hex or letters only: a `$` breaks the compose .env.
   - `beauty-admin-phone` (ADMIN_PHONE, your number in +48 form): `security add-generic-password -a "$USER" -s beauty-admin-phone -w`.
   - `beauty-admin-notify-url` (ADMIN_NOTIFY_URL, the full URL of your private ntfy topic): `security add-generic-password -a "$USER" -s beauty-admin-notify-url -w`. This is your only real notice of a new salon while SMS stays `log`.
   - `beauty-operator-name` (OPERATOR_NAME, the legal name and address on the privacy page): `security add-generic-password -a "$USER" -s beauty-operator-name -w`. Do not use a single quote. Without it, the deploy prints a warning and the page shows 'operator tego serwera'.
   - `tools/deploy.sh` generates `beauty-db-password` and `beauty-app-secret` when they are missing. `beauty-signup-code` and `beauty-smsapi-token` are optional; leave them out for now (SMS stays `log`).
3. **DNS.** Add an A record (and AAAA, if used) for `beauty.appnice.dev` that points to the VPS. Wait until it resolves.
4. **Local gates.** Run `make check`, `make e2e` and `make deploy-local`. All must exit 0.
5. **Deploy.** Run `SSH_TARGET=<user@host> CADDYFILE=<host path of the shared Caddyfile> CADDY_CONTAINER=<caddy container> make deploy`. This one command does these steps:
   1. It builds linux/amd64 on the Mac (the first real buildx run).
   2. It checks port 8150 and 400 MB of free memory on the host.
   3. It sends the files with rsync to `/opt/beauty`.
   4. It takes a predeploy backup and tags `beauty-app:prev`.
   5. It writes `/opt/beauty/.env` from the Keychain (umask 077, values never printed), `OPERATOR_NAME` included.
   6. It runs `docker compose -p beauty up -d` and waits for the healthcheck.
   7. It runs `tools/deploy-caddy.sh`: one site block, validate, reload, and a restore on failure.
   8. It smokes `https://beauty.appnice.dev`.
6. **On a later change of the env values** (for example a new operator name), use `SECRETS=1 make deploy`.
7. **Smoke by hand.**
   - Sign up a test salon. With `SMS_PROVIDER=log` and `SMS_ECHO=off`, no real SMS goes out. Read the owner code in the server log on the VPS: `docker compose -p beauty logs app | grep sms:log`.
   - Check that the ntfy POST arrives and that the privacy page shows the operator name.
   - Accept the salon at `/admin`.
   - Delete or reject it after the test.
8. **If the deploy fails,** run `make rollback`. If a migration blocks the old image, restore the `predeploy` dump with `tools/restore.sh`.
9. **After the deploy.** Set up an off-site encrypted copy of `/opt/beauty/backups`, and commit the repo and STATE.md.

## STATE.md

`projects/beauty/STATE.md` has one line per task under "Build progress (harness)". Task #006 added "2026-11-11 R End-to-end check (task #006)". Task #007 added "2026-11-11 Editor fixes round 1 (task #007)" with its `make check` counts.

## Processes and containers

- **Started by task #006 and stopped:** the Playwright servers on 8151 and 8159 stopped with Playwright. Task #006 removed the beauty-deploy-local and beauty-selfhost-check stacks with down -v.
- **Started by task #007:** only `make check` (no server, no browser) and one `docker compose config` call (no container).
- **Left as they were:** `beauty-local-db-1` (it was up before task #006 started), taxi-db, digitally-local-* and PID 4055.
