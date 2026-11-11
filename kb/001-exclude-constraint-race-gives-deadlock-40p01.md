# S1 Core: beauty repo, EXCLUDE race can give 40P01
Builds on: nothing

## Verified by the supervisor
- Repo: /Users/patrykjuniszewski/appnice-apps/repos/beauty. Command `make check` passes: svelte-check 0 errors, prettier clean, vitest 7 files, 78 tests.
- The supervisor ran `npx vitest run --reporter=verbose` a second time. Result: 78 of 78.
- `make seed` prints "4 stylists, 10 services, 28 clients, 169 visits".
- migrations/001_init.sql holds `constraint visit_no_overlap exclude using gist (staff_id with =, during with &&)` on active statuses.
- tests/booking.test.ts races two connections. Result: 1 success and 1 AppError TERM_TAKEN.
- tests/tenant.test.ts walks the API route files and checks that salon B does not change.
- tests/availability.test.ts covers both DST days: 2026-03-29 and 2026-10-25.
- After `make db-stop`, no beauty container and no listener on 8150-8159 remain.
- CLAUDE.md has 57 lines. README.md has 74 lines.

## Stack (worker report)
- SvelteKit 2.70.4, Svelte 5, TS 6, adapter-node, Postgres 16 on 127.0.0.1:55440, pg-boss 12.38.0, postgres.js 4.1.1, zod 4.
- Time uses the Node 26 built-in Temporal API. There is no date-fns-tz.
- `visit.during` is a generated column from `blocked_until` (end plus buffer). Postgres rejects `timestamptz + interval` there.

## Gotchas (worker claims, not re-checked by the supervisor)
- Unverified: two conflicting concurrent inserts can make Postgres abort one with 40P01 (deadlock), not 23P01. The worker added `retryDeadlock()` in src/lib/server/db.ts. The retry then gets 23P01.
- All visit writes must go through createVisit and moveVisit.
- postgres.js 4.x sends parameters untyped. Use ISO strings with `::timestamptz` casts and TimeZone=UTC.
- Route files may export only HTTP methods. Shared zod schemas live in src/lib/server/schemas.ts.
- adapter-node reports https: unless ORIGIN or PROTOCOL_HEADER is set. The cookie Secure flag follows PUBLIC_URL.
- The buffer after a service must be free of blocks. It may go past closing time. The RFC does not say this.

## Open threads
- engines.node says `>=24`. Only Node 26.11.1 was tested. Raise it to `>=26` and use a Node 26 image in the S4 Dockerfile.
- S4 deploy must set PUBLIC_URL=https://beauty.appnice.dev and ORIGIN or PROTOCOL_HEADER.
- Owner decisions: licence (MIT or AGPL), a real SMSAPI token, and the deploy.
- The main session must commit the repo paths and projects/beauty/STATE.md. The worker did not commit.
- Local Postgres volume beauty-local_beauty-db remains with the demo seed.

## Lesson
- cue: A system must prevent double booking when many clients write at the same time, and the guard is a database constraint.
- lesson: Test the constraint with two real concurrent connections, not only a sequential duplicate. Expect a deadlock error as well as the constraint error. Wrap the write in a retry.
- evidence: The supervisor confirmed the two-connection race gives 1 success and 1 TERM_TAKEN. The worker reported 40P01 before the retry fix (unverified by the supervisor).
- confidence: low. It rests on one run, and the supervisor did not confirm the deadlock claim.
