# S2 sign-up with approval, owner panel, admin, stylist view
Builds on: 001-exclude-constraint-race-gives-deadlock-40p01.md, #001

Status: supervisor verdict pass. Nothing is committed. The main session commits.

## Verified by the supervisor
- `make check` exit 0: svelte-check 0 errors, vitest 8 files, 92 tests.
- `make e2e` exit 0 on a second run: 10 passed (admin 2, calendar 1, pending-stylist 2, screens 3, signup 2).
- No listener on ports 8150-8159 after the run.
- `cmp` shows 8 of 12 design screens byte-identical to the app render (Main, Kod, Salon, Zespol, Godziny, Gotowe, Czekaja, Admin).

## Where things live
- Migration: migrations/003_approval.sql (salon status pending/active/rejected, "O salonie" fields, admin_audit, admin_session).
- Server: src/lib/server/approval.ts, admin.ts, salons.ts (signup()).
- Sign-up check order: honeypot, invite code, phone token, one salon per phone, 3 per IP a day, 30 pending at most.
- /admin returns 404 when ADMIN_PASSWORD is empty. Admin login allows 5 tries per IP in 15 minutes.
- Rejected salons are purged after 30 days by a daily pg-boss job. The audit keeps the salon name.
- Pending salons send no client SMS (clientSmsAllowed). The public page shows the name only, with noindex.
- Design check: docs/design/support.js, tests/e2e/screens.spec.ts, tools/side-by-side.html. Screens are in docs/screens/ and docs/screens/design/.
- The screens spec uses a fixed browser clock (2025-11-12 11:20 Europe/Warsaw) and self-hosted fonts.

## Gotchas
- Panel, admin and wizard use ssr = false. A stylist on an owner page gets an HTML shell with status 200. The 403 page shows after hydration. The API still answers 403.
- StepHeader back button needs type="button". Without it, Enter in a field submits the form.
- Behind Caddy, adapter-node needs ADDRESS_HEADER and XFF_DEPTH. Otherwise every sign-up and admin login shows the proxy IP. The S4 deploy must set this.
- Design data conflict: Ustawienia shows 4 services, Kalendarz shows 7. The screens spec turns off 3 services first.
- Worker used createVisit and moveVisit from S1 only, so retryDeadlock stays in force (unverified by the supervisor).

## Open threads
- A stray `node build` process (PID 4055) runs from before this task. The main session can kill it.
- Owner must set ADMIN_PASSWORD, ADMIN_PHONE, ADMIN_NOTIFY_URL on the VPS. Real SMS stays off (log only).
- The owner decides if a stylist sees the client phone. Now she does not.
- One '[api] Error: UNDEFINED_VALUE' appeared once after a dirty DB (worker only). It did not recur in 2 supervisor runs.
- Pixel diffs of 0.03 % to 0.09 % for Uslugi and Ustawienia are worker claims, not re-run by the supervisor.

## Lesson
- cue: A UI must match a design mockup, and a human eye check is the only test.
- lesson: Render the design and the app at the same size with a fixed clock and offline fonts. Compare with `cmp` or a pixel diff in the e2e spec. Add a text-node copy check.
- evidence: `cmp` showed 8 of 12 screens byte-identical, and the supervisor confirmed it. The supervisor viewed Kalendarz.png by eye and found it matching.
- confidence: medium. It rests on one run. The supervisor confirmed only the `cmp` count and one screen.
