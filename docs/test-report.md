# Test report: CommitteeKeeper v1.0

**Author:** Ahmed Malik · **Date:** 19 October 2026 · **Related:** [Test plan](test-plan.md) · [BRD](BRD.md) · [PRD](PRD.md)

All numbers below come from runs on 19 October 2026 (release commit `ac65339`, and the commits just before it).

## Summary

| Level | Result |
|---|---|
| Unit (Vitest) | **189 passed**, 0 failed (16 files) |
| Role-check script (database, acts as each role) | **156 checks passed**, 0 failed |
| System (Playwright), local production build | Full run on the final tree before the last features: 301 passed, 5 passed on retry, 2 failed on connection errors (both passed when re-run alone), 1 skipped by design. The two newest specs (home screen, member account) were re-run after the last change: 17 passed |
| System, live site (`committeekeeper.vercel.app`), the release build `ac65339`, 226 runs, 2 workers, 1 retry, 34 minutes | **221 passed, 3 passed on retry, 1 skipped by design, 1 failed.** The failure (`member-payments`, "my payments with my receipts", desktop Edge) hit its 400 s timeout and passed when re-run alone in 47 s. The same test also failed once in the previous live run on a connection reset, so it is the first one to look at if live runs keep stalling. The three retried tests were the "signing out on another device" test and two member-link tests, all slow-network timeouts. An earlier live run on the commit before the last feature had 6 failures, all connection errors from the test computer, all passing when re-run alone |
| Accessibility (axe-core, WCAG 2.2 AA) | 9 main screens at laptop and phone size: no violations after the fixes below |
| Type check | Clean |

A test is a pass only when it passed without code changes; the "failed, passed alone" tests are reported as failures of the run, not hidden. No failure traced to a defect in the application.

## Where tests run

- Desktop Chrome: every system test.
- Desktop Edge (also Chromium): the core flows, as a cross-check.
- 375 px phone view: layout, touch and accessibility checks, including long Urdu-script names.
- Setup that is only data (a running committee with members and payments) is made through the same database functions the screens call; the guided flows (create, add a member, start) are still clicked through in their own tests.
- A 17-test `@smoke` set is run against the live site after each deploy.

## Defects found by testing and review

| Found | Fixed |
|---|---|
| Printing the history hid the "Intact" result | The result is shown in print |
| A 13th member could join a running 12-slot committee (found in use) | The form is gone while running; the action refuses it; new people join only through "A member leaves" (#29) |
| Logo link on phones had no accessible name; two Copy buttons' names omitted their visible words | Names fixed; the scan now runs on every main screen |
| The payments query silently stopped at 1,000 rows and built over-long requests for very large accounts | Fetched in chunks of 25 with paging |
| The member page said "this link doesn't work" during a database outage | It now says it could not load the page |
| A receipt lookup error answered "not found" | It now answers "bad gateway" (a server-side problem), not "not found" |
| Text lines too wide on large screens; placeholder text contrast; touch targets under 44 px | Reading width, colour and touch size fixed |
| The home screen got slow for an account with hundreds of committees | Test accounts are kept small; the payment query is chunked (see above) |

## Test speed

The first full run took about 1.5 hours (354 runs) because almost every test built its own committee by clicking through the app. Seeding through the database, running each test only where it matters and a smoke set brought the live-site run to 223 runs in 52 minutes, and the release run (226 runs) to 34 minutes.

## Known gaps (not tested, not claimed)

- **No real-organiser pilot yet.** One organiser answered questions and saw the clickable prototype; she has not run a real committee in the app. The manual tests MT-4 and MT-5 in the plan are open.
- **Real-phone checks** (MT-1 to MT-3: install, receipt from the gallery, print) are not recorded here.
- **The daily reminder job and members' receipt links** need server settings (a service key, the job's secret and an email sender) that I could not set up and check on the live site, so they are tested against a local server only. Where a setting is missing the app says "not set up" instead of failing silently.
- **Safari and Firefox** are not tested.
- **The history check** is covered by unit tests of the chain logic and a manual SQL tamper test; there is no browser test that corrupts the database.
- Test data cannot be deleted from the development database (history is permanent by design), so it has been left in place; start a fresh database before real use.
