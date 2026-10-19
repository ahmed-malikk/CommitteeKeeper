# CommitteeKeeper

Keep your kameti honest: who paid, whose turn it is, and a history nobody can quietly change.

CommitteeKeeper is a web app for the organiser of a kameti (a rotating savings committee). The organiser records payments and receipts, runs the draw, handles members who leave, and keeps a permanent history. Members can follow their own turn from a private link, without installing anything.

> **Status:** v1.0, live at [committeekeeper.vercel.app](https://committeekeeper.vercel.app). Every planned feature is built and tested ([test report](docs/test-report.md)). Not yet used by a real organiser for a real committee.

**Documents:** [PRD](docs/PRD.md) · [BRD](docs/BRD.md) · [business rules](docs/business-rules.md) · [test plan](docs/test-plan.md) · [test report](docs/test-report.md) · [API requests](docs/api/manual-api-testing.md)

## Run it locally

Requires Node 22 or newer.

```bash
npm ci
npm run dev        # http://localhost:3000
```

Copy `.env.example` to `.env.local` and fill in the Supabase values when a feature needs the database. Never commit `.env.local`.

## Checks

```bash
npm run typecheck  # TypeScript
npm test           # unit tests (Vitest)
npm run build      # production build
npm run test:e2e   # builds, then every system test (Playwright; see below)
npm run test:smoke # the short post-deploy set (about 17 tests): E2E_BASE_URL=https://your-site npm run test:smoke
```

Every push runs the type check, unit tests and build on GitHub Actions.

### How the system tests are organised

- **Each test runs where it matters.** Every test runs in desktop Chrome. Edge is Chromium too, so it re-runs only the core flows (accounts, committees, members, payments, links, history, privacy, accessibility) as a cross-check. The 375 px phone view runs the layout, touch and accessibility checks, the things a phone can actually break.
- **Setup is seeded through the database.** A test that only needs a committee to exist (running, with members, with a payment) creates it through the same database functions the screens call, in about a second. Tests that are about the guided flow itself (creating a committee, adding a member, starting) still click through it.
- **A short smoke set** (tests tagged `@smoke`) proves the app works after a deploy; the full set runs before a release. `E2E_WORKERS=2` runs files in parallel (only on a fast machine: three workers starved this laptop), `E2E_RETRIES=1` retries a failed test once.
- An accessibility scan (axe-core, WCAG 2.2 AA) covers every main screen.

## The history, and what its check proves

Every change to a committee (a payment, a correction, a draw, a payout) is written to a history that cannot be edited or deleted: the database refuses `UPDATE` and `DELETE` on it for every role, including the organiser's own session, and a correction is a new entry that points to the original. Each entry stores a fingerprint (a SHA-256 hash) of its own contents plus the fingerprint of the entry before it, so the entries form a chain. The History page recomputes the whole chain every time it opens.

**What the check proves:** that no entry was changed, removed, reordered or slipped in between existing ones after it was written, and it says which entry number is the first to break.

**What it cannot prove:** that what was typed in the first place was true (a wrong amount recorded honestly is still recorded), or that nobody with direct access to the database itself rewrote the whole chain from the start. It makes quiet changes visible; it does not replace trust in the organiser.

The History page also prints or saves as a PDF in the app's own design.

## Stack

Next.js and TypeScript, Supabase (Postgres with row-level security) for data, Vercel for hosting.
