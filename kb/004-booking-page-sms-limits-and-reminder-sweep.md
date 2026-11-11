# KB 004: Client booking page, confirmation mode, SMS limits and reminder sweep
Builds on: 001-exclude-constraint-race-gives-deadlock-40p01.md, 003-signup-approval-gate-and-pixel-matched-panel.md, 003-s2-signup-approval-panel-design-match.md, #003

## Verified (supervisor re-ran the gates)
- `make check` exit 0: 747 files, 0 errors, 0 warnings, 11 test files, 127 tests.
- `make e2e` exit 0: 17 passed (43.4s).
- The supervisor read templates.ts, jobs.ts (`sweepReminders`), migration 004, booking.spec.ts and `deleteClient`. Criteria S2.C1 to S2.C8 hold.
- No listener on ports 8150-8159. The stray `node build` PID 4055 and container `beauty-local-db-1` pre-date this task.

## Where things live
- Migration: `migrations/004_booking.sql` (`salon.cancel_cutoff_hours`, `client.erased_at`, status 'limit', unique index `notification_once`).
- SMS texts: `src/lib/server/sms/templates.ts`. `gsm()` strips non-GSM characters. `fit()` shortens names so the text has 160 characters or fewer. The link stays whole.
- Reminders: `sweepReminders` in `src/lib/server/jobs.ts`. A pg-boss cron `sms-sweep` runs it every 10 min (tz Europe/Warsaw).
- Day-before reminder: 17:00 to 20:59 only. No SMS from 21:00 to 8:00.
- Pages: `/[salon]` (step machine), `/[salon]/wizyta/[token]`, `/w/[token]` (302), `/[salon]/prywatnosc`.
- RODO: `deleteClient` blanks the client and keeps the visit rows. Template: `docs/umowa-powierzenia.md` (needs a lawyer).
- Screens: `docs/screens/Klient-*.png` at 390 and 1440 px.

## Gotchas
- The link `${PUBLIC_URL}/w/<token>` has about 74 characters. Fixed words must stay short to fit 160 characters.
- Slug 'w' is reserved in tenant.ts.
- Index `notification_once` needs `visit_id is not null`. Without it, the screens seed collides. The worker rebuilt this one index by hand in the dev DB (unverified by the supervisor).
- Phone numbers in e2e: use 6043xxxxx to 6047xxxxx. 603300000 clashes with pending-stylist (one salon per phone).
- Playwright `getByText(regex)` fails on text split by a source line break. Compare instants by epoch (API sends `:00Z`, JS Date gives `:00.000Z`).

## Open threads
- `[api] Error: UNDEFINED_VALUE` at `checkSignupLimits` (salons.js:32) still shows in the e2e log. Cause unknown. A request with no IP may return 500. Follow-up created.
- A visit booked after 21:00 gets no day-before reminder. A moved visit with a sent reminder gets none again. Owner decides.
- `gsm()` keeps GSM accents such as é and ü. Owner decides if S2.C6 needs a strict strip.
- The 3-per-phone-per-24h limit counts online visits, not `rateLimit` rows. A cancelled visit still counts. Owner decides.
- No panel field for `cancel_cutoff_hours` (default 2).
- Owner actions: deploy, set OPERATOR_NAME, PUBLIC_URL, APP_SECRET, SMS_MONTHLY_LIMIT, pick a real SMS gateway, commit.

## Lesson
- cue: A delayed or queued job acts on a record that a person or another process can change before the job runs.
- lesson: Store the expected state (here the visit status) in the job payload. In the job loader, skip the job if the state changed. Use a unique index for send-once rows.
- evidence: Worker saw two 'potwierdzenie' SMS in e2e S2.C2 before the fix. The supervisor confirmed that booking.spec checks one notification row per SMS in manual mode. The supervisor did not re-create the race itself.
- confidence: low, because it rests on one run and the pre-fix failure is a worker claim.
