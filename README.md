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

## Stack

Next.js and TypeScript, Supabase (Postgres with row-level security) for data, Vercel for hosting.
