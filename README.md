# CommitteeKeeper

Keep your kameti honest: who paid, whose turn it is, and a history nobody can quietly change.

CommitteeKeeper is a web app for the organiser of a kameti (a rotating savings committee). The organiser records payments and receipts, runs the draw, handles members who leave, and keeps a permanent history. Members can follow their own turn from a private link, without installing anything.

> **Status:** under construction. This page grows as features ship; see the [project board](https://github.com/users/ahmed-malikk/projects/4) for what is built and what is next.

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
npm run test:e2e   # builds, then system tests (Playwright: desktop Edge, desktop Chrome, 375 px phone)
```

Every push runs the type check, unit tests and build on GitHub Actions.

## The history, and what its check proves

Every change to a committee (a payment, a correction, a draw, a payout) is written to a history that cannot be edited or deleted: the database refuses `UPDATE` and `DELETE` on it for every role, including the organiser's own session, and a correction is a new entry that points to the original. Each entry stores a fingerprint (a SHA-256 hash) of its own contents plus the fingerprint of the entry before it, so the entries form a chain. The History page recomputes the whole chain every time it opens.

**What the check proves:** that no entry was changed, removed, reordered or slipped in between existing ones after it was written, and it says which entry number is the first to break.

**What it cannot prove:** that what was typed in the first place was true (a wrong amount recorded honestly is still recorded), or that nobody with direct access to the database itself rewrote the whole chain from the start. It makes quiet changes visible; it does not replace trust in the organiser.

The History page also prints or saves as a PDF in the app's own design.

## Stack

Next.js and TypeScript, Supabase (Postgres with row-level security) for data, Vercel for hosting.
