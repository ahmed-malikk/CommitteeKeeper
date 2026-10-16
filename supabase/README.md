# Database

Postgres on Supabase. Everything about the data lives in the numbered files in `migrations/`; they are run once each, in order, in the Supabase SQL Editor. A migration that has been run is never edited: a change goes in a new numbered file.

| File | What it adds |
|---|---|
| `001_core` | profiles, committees, members, slots, slot holders; row-level security and read-only grants |
| `002_ledger` | the history table that refuses every change, each entry chained to the one before by a fingerprint, and `verify_chain()` |
| `003_payments` | payments, receipts, payouts and the reminder log (all append-only, apart from marking a receipt removed) |
| `004a_functions_setup` | create, edit and start a committee; members, slots, turn order |
| `004b_functions_payments` | record and correct payments, attach and remove receipts, record payouts |
| `004c_functions_turns` | draws, swaps, replacing a member who leaves, completing a committee |
| `005_functions_member` | what a member sees through a private link or an account; link management |
| `006_storage` | the private receipts bucket and who may use it |
| `007_hardening` | removes rights found by the table check (TRUNCATE, rights for signed-out users) |
| `008_fix_start_problems` | fixes `start_committee` listing a problem as plain text (found by the role-check script's first run) |

## How the security works

- Row-level security is on for every table. Signed-in users can only read; there is no direct write access to any table.
- Every change goes through a function that checks who is asking and what state the committee is in, changes the data, and adds the history entry in the same step.
- Members and signed-out visitors have no table access at all. They only call functions that return their own information.
- **What the history proves:** nothing in it was quietly changed or removed in the middle by the app or an ordinary database user. **What it does not prove:** someone with full administrator control of the database could rebuild the whole chain, and the newest entries could be removed without a gap showing.

## Checks

- `scripts/check-security.mjs` signs in as organiser A, organiser B, a member with an account and a signed-out visitor and tries things that must work and things that must fail. Run it against a development database only: the history cannot be deleted, so each run leaves one committee named "Security check" behind.
- `scripts/check-tables-summary.sql` (run in the SQL Editor) lists tables without row-level security, stray table rights, and which functions a signed-out visitor can run. `scripts/check-tables-details.sql` has the same checks one by one plus a tamper test for the chain check.
