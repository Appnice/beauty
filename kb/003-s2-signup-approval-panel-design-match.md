# S2 Owner sign-up with approval, owner panel, admin, stylist view
Builds on: 001

## Result (worker, task #003)
- `make check` exit 0: svelte-check "721 FILES 0 ERRORS 0 WARNINGS", vitest "Test Files 8 passed (8), Tests 92 passed (92)".
- `npx vitest run tests/approval.test.ts`: "Tests 12 passed (12)".
- `make e2e` exit 0: "10 passed (29.9s)". Specs: signup, admin, calendar, pending-stylist, screens.
- Migration 003 adds salon status, the "O salonie" fields, `admin_audit`, `admin_session`, and a unique index on `salon(phone)` for non-demo salons.

## Design match (measured)
- The worker renders each `docs/design/*.dc.html` with the local `docs/design/support.js`. The renderer handles DCLogic, sc-for, sc-if, dc-import and {{path}}.
- A pixel compare of design PNG and app PNG at the same size gives these results:
  - Byte-identical (`cmp`): Main, Kod, Salon, Zespol, Godziny, Gotowe, Czekaja, Admin (8 of 12).
  - NowaWizyta and Kalendarz: 0.00 % over the threshold (Kalendarz: 2 pixels at the Magda avatar).
  - Uslugi: 0.03 % (checkbox edges).
  - Ustawienia: 0.09 %. The app adds one "Wyloguj się" button. The design has no logout.
- The copy check asserts that every text node of each design shows on the app screen. It passes for all 12 screens.

## Gotchas
- A `<button>` in a `<form>` with no `type="button"` is a submit button. Enter in a field "clicks" the first one. The wizard back arrow went back one step this way.
- The design boxes are content-box. Chromium draws a 1.5 px border as 1 px at 1x. So a 64 px row is 66 px at 1x and 67 px at 2x. Use `box-sizing: content-box` with the design numbers, not a computed height.
- The design inputs inherit weight 600 from their label (`input{font:inherit}`).
- With `ssr = false` the page shell answers 200. A guard error in a server load shows the error page in the browser. Test the text, not the HTTP status.
- `purgeRejected` compares microseconds. A JS Date keeps only milliseconds. A test with "exactly 30 days" from a JS Date misses by under 1 ms.
- `PUBLIC_URL=https://...` makes cookies `Secure`. Chromium accepts them on http://localhost, so the e2e server uses the production host in links.

## Decisions taken in the build
- The panel, admin and wizard render in the browser only (`ssr = false`). The browser clock gives the day, "Dziś", "dziś 18:42" and the SMS month. The API takes the date in the query.
- The owner's first calendar column gets a name from the salon name ("Studio Ola" gives "Ola", else "Ja"). The wizard does not ask for her name.
- "Urlopy i przerwy" opens from the Zespół page, so Ustawienia keeps the 4 tiles of the design.
- The 3-per-IP rule counts salon rows with `signup_ip` in the last 24 h. It does not use `rate_limit`.

## Open threads
- Ustawienia (design) says "4 usługi"; Kalendarz (design) uses 7 services. The screens spec hides 3 services before the Ustawienia shot.
- A stray `node build` (PID 4055, started 18:35 before this task, cwd repos/beauty, no listening port) was running. The worker did not stop it.
- One run logged `[api] Error: UNDEFINED_VALUE` once (a failed run with a leftover salon). Later runs did not show it. The worker did not find the cause.

## Lesson
- cue: A UI build must match an HTML design file, and the design file renders in a browser.
- lesson: Render the design and the app at the same size and compare pixels, not only eyes. Read the diff image: a 1 px rail offset or a box-sizing rule shows as red outlines over the whole screen.
- evidence: Before the compare, 7 of 12 pairs differed (up to 3.44 %). Three fixes (rail content-box, row content-box, input weight 600) brought 8 pairs to byte-identical and 2 more to 0.00 %.
- confidence: medium. One run; the numbers come from the compare script in this task.
