# Test plan: CommitteeKeeper

**Author:** Ahmed Malik · **Date:** 15 October 2026 · **Status:** followed for v1.0 · **Related:** [PRD](PRD.md) · [BRD](BRD.md)

## 1. Purpose and scope

Show that each requirement in the BRD is met, in the setups real users have, before and after deployment. Every test traces to a requirement (BRD §6) and a story (PRD §5).

## 2. Test levels

| Level | Tool | What it proves |
|---|---|---|
| Unit | Vitest | Business rules in `src/lib` (committee state machine, ledger and splits, schedule, validation, reminders) with no screen involved |
| Database | SQL script run by Ahmed in the SQL Editor, and a role-check script | History can't be updated or deleted; each role sees only what it should; receipts are private |
| System | Playwright | The real app in a browser, like a user |
| Manual | Checklist | Real phone, installation, print, one real committee |

## 3. Environments

| Project | Setup |
|---|---|
| Desktop Edge | 1280 x 800 |
| Desktop Chrome | 1280 x 800 |
| Phone | 375 px width |
| **Real setup** | Windows classic scrollbars; browser zoom 80%, 100% and 125%; short window (600 px high); pointer parked away from the target; reduced motion on |
| Real phone | Android, Chrome, production build over Wi-Fi, then the live site |

System tests run against the local production build first (`npm run build`, then Playwright) and against the live URL after deployment (`E2E_BASE_URL=... npx playwright test`; `npm run test:smoke` for the short post-deploy set). CI runs the type check, unit tests and build on every push; the system tests are run by hand before a release.

## 4. Test data

- Test committees carry a time stamp in their names. A committee's history cannot be deleted by design, so test data stays in the development database; each run uses fresh committees, and committee-list tests use their own fresh account.
- Receipt images are made-up images only.
- Demo logins are public and contain no real information.
- A real organiser's committee, with names changed, is a separate manual test (§8).

## 5. Roles checked by the role script

signed out · organiser · a different organiser · member with a link · member with an account · a person who is organiser in one committee and member in another.

## 6. Entry and exit criteria

**Entry:** story has acceptance criteria, a mock link and its rule; the test cases for it are written first.
**Exit (release):** all Must tests pass in all environments, locally and on the live site; role script 100%; history tests pass; no open defect rated high; known gaps are listed in the test report.

## 7. Traceability (examples)

| Requirement | Story | Test cases | Level |
|---|---|---|---|
| FR-1 | US-1 | TC-001 to TC-004 | System |
| FR-4 | US-4, US-5 | see test cases | Unit, system |
| FR-5 | US-6, US-15 | see test cases | Unit, system |
| FR-11 | US-11 | see test cases | Unit |
| FR-13 | US-13, US-14 | see test cases | Unit, database |
| NFR-4 | all | see test cases | System (real setup) |

Every requirement in the BRD has at least one test case; the results are in the [test report](test-report.md).

## 8. Manual tests

| ID | Test |
|---|---|
| MT-1 | Install the web app on an Android phone and open it from the home screen |
| MT-2 | Record a payment with a receipt from the phone gallery; time it |
| MT-3 | Print and save as PDF from the committee page and the history |
| MT-4 | Enter one real committee (names changed) and compare every total with the organiser's notebook |
| MT-5 | An organiser sets up a committee herself; note where she hesitates (observed or reported) |
| MT-6 | Usability: a first-time member opens a link and finds their draw, months left and the status |

## 9. Defects

Found by testing, logged as `bug` issues, fixed with `fix:` commits, and retested. Anything not fixed is listed in the test report.

## 10. Risks to testing

Slow or dropped connections between the test machine and the database; flaky tests from timing. Handled by seeding test data through the database, limited parallel workers, one retry, and reading traces before changing code.
