# Task #006: full chain from sign-up to cancel passes end-to-end
Builds on: 003-signup-approval-gate-and-pixel-matched-panel.md, 003-s2-signup-approval-panel-design-match.md, 004-booking-page-sms-limits-and-reminder-sweep.md, 005-selfhost-deploy-package-proven-locally-no-real-host.md, #003, #004, #005

## Verified (supervisor re-ran each command)
- `make e2e-chain`: exit 0, "1 passed (16.4s)", 8 SMS rows. The worker ran it 2 times on a fresh DB.
- `make check`: exit 0, 754 files 0 errors, 132 tests passed, 22 "test_deploy: ok".
- `make e2e`: exit 0, "18 passed", 0 UNDEFINED lines in the log.
- `make deploy-local`: exit 0, smoke PASS 16 checks on 8152 and 8153, browser-smoke PASS 4, memory.peak about 113 MiB of 256 MiB, /health 503 with the DB stopped.
- After the runs, no listener on 8150-8159 and no browser runs. Only beauty-local-db-1 remains (it ran before the task).

## Where things live
- Spec: tests/e2e/chain.spec.ts. Target: `make e2e-chain` (build, fresh beauty_e2e DB, playwright).
- The worker updated CLAUDE.md, README.md, Makefile and projects/beauty/STATE.md. CLAUDE.md has 100 lines, the limit. The next addition must remove a line.
- All files in repos/beauty are untracked. Nothing is committed. Commit explicit paths, never `git add -A`.

## Answer to the owner's question
- One salon per phone (unique index on salon(phone)). An SMS code verifies the phone first.
- Each salon needs owner approval at /admin. A pending salon has no online booking and sends no client SMS.
- Limits: 3 sign-ups per IP per day, 30 pending salons in total, a honeypot field, an optional SIGNUP_CODE.

## Gotchas
- The worker made one test-only fix. sweepReminders ran in the Playwright process with another APP_SECRET. The reminder link then gave "Nie znaleziono wizyty." The spec now sets APP_SECRET and PUBLIC_URL from E2E_ENV. The app needs no change.
- Race (worker only, unverified): a cancel within about 10 s of "Przyjmij" leaves the confirmation job in state `created`. The client gets no "confirmed" SMS.
- Reception visits send no confirmation SMS. They get the day-before reminder only.
- UNDEFINED_VALUE did not appear in the `make e2e` log. The cause is not proven.

## Open threads
- Stray `node build` PID 4055 still runs. Not from this task. Only the owner kills it.
- The supervisor did not re-run the clean install (`rm -rf node_modules build .svelte-kit`). This claim is the worker's only.
- Gaps: no SMS gateway (only the `log` provider), no panel toggle for show_prices or buffer, no backup encryption, no amd64 build run on a real host.
- Owner decisions: licence (MIT or AGPL), processor name for the privacy page, stylist sees client phone, reminder for bookings after 21:00.
- Deploy to beauty.appnice.dev needs a yes from Patryk in the main session. Steps are in the worker report.

## Lesson
- cue: A test calls server code in its own process (a cron sweep, a signer). The real server runs in another process with its own env.
- lesson: Load the server env (APP_SECRET, PUBLIC_URL) into the test process before the call. Else the test signs links with other secrets.
- evidence: The first chain run gave "Nie znaleziono wizyty." on the reminder link. After the test took APP_SECRET and PUBLIC_URL from E2E_ENV, `make e2e-chain` passed (supervisor re-run: "1 passed (16.4s)").
- confidence: low. The failure and the cause come from the worker report only. The supervisor saw only the passing run.
