# BRD: CommitteeKeeper

**Author:** Ahmed Malik · **Date:** 15 October 2026 · **Status:** approved for build · **Related:** [PRD](PRD.md) · [Business rules](business-rules.md)

## 1. Business need

Informal savings committees are run on a notebook and WhatsApp. The organiser spends time chasing late payers (some weeks late), recalculating who is owed what when members leave or are replaced, and settling arguments about who paid. There is no record that both sides can trust. CommitteeKeeper gives the organiser one reliable, tamper-evident record per committee, and gives optional members a way to see their own position, without ever handling money.

## 2. Objectives

| # | Objective | Measure |
|---|---|---|
| O-1 | The organiser can run a real committee from start to finish in the app | R1's real committee entered; totals match her notebook |
| O-2 | Disputes about who paid are settled from the record | Each payment shows date, method and receipt; history can't be changed |
| O-3 | Calculations done by hand today are done by the app | Leaver/replacement split, turn order, late days: all unit-tested against worked examples |
| O-4 | Less time chasing | Reminders and prepared messages; time saved reported by R1 (as her own account) |
| O-5 | Members can answer their own questions | Link or account shows their draw, months left and status |

## 3. Stakeholders

| Stakeholder | Interest | Influence |
|---|---|---|
| Organiser (R1 and others like her) | Runs everything; wants less chasing and fewer errors | Primary user, decides what members see |
| Member | Wants to know when their turn is | Secondary; optional use |
| Product owner (Ahmed) | Delivers a working, tested product to a fixed plan | Decides scope |

## 4. Scope

**In:** the five MVP features in the PRD. **Out:** see PRD non-goals. **Assumption:** each committee uses equal instalments and one pot per period; this holds in R1's committees.

## 5. Current process and proposed process

**Today (R1):** an organiser writes payments in a notebook; reminds people on WhatsApp (twice, then individually); members pay by cash, bank deposit or wallet and send screenshots in WhatsApp; draws are done by hand or at random; swaps and leavers are worked out by hand; several committees are tracked separately.

**With CommitteeKeeper:** the organiser records each payment once (with the screenshot attached); the app shows who is pending and late; draws and swaps are recorded and visible in the history; a leaver and replacement split is calculated; a daily summary and ready-to-send messages replace memory; members open a link for their own answers.

## 6. Requirements

IDs are traced to the stories in the PRD and to the GitHub issues, each of which lists its requirement IDs.

### Functional

| ID | Requirement | Story | Priority |
|---|---|---|---|
| FR-1 | Organiser accounts with email sign-up and sign-in | US-1 | Must |
| FR-2 | Create a committee with the settings in rules §9 and save them as its agreement | US-2 | Must |
| FR-3 | Members and slots, including several slots per member (2 to 30 slots) | US-3 | Must |
| FR-4 | Turn order by hand, start draw or monthly draw, with redo; mode can change; paid-out turns are locked | US-4, US-5 | Must |
| FR-5 | Committee status forming, running, completed with the guards in rules §6; any other move is refused with a clear reason | US-6, US-15 | Must |
| FR-6 | Start a committee that is already running, with backdated entries that store happened-on and recorded-at | US-6 | Must |
| FR-7 | Record a payment (member/slot, period, date, method, note); full instalment only | US-7 | Must |
| FR-8 | Attach up to 2 receipt images per payment; private storage; fingerprint in the history; removal adds an entry | US-8 | Must |
| FR-9 | Pending and late list, per-period grid, "late by N days" | US-9 | Must |
| FR-10 | Swap two unpaid-out turns | US-10 | Must |
| FR-11 | Leaver and replacement handling with the split at the slot's turn | US-11 | Must |
| FR-12 | Record that a pot was handed over | US-12 | Must |
| FR-13 | Append-only history; corrections as new entries; hash chain check | US-13, US-14 | Must |
| FR-14 | Daily scheduled job; organiser summary in the app and by email; prepared WhatsApp message per pending member; idempotent | US-16 | Must |
| FR-15 | Private link per member that the organiser can turn off | US-17 | Must |
| FR-16 | Member view: own turn(s), months left, committee status | US-18 | Must |
| FR-17 | Optional view-only member account attached to a link | US-19 | Must |
| FR-18 | Member sees own payments and receipts only | US-20 | Must |
| FR-19 | Organiser controls what members can see (other members' payment status off by default; whose turn off by default) | US-21 | Must |
| FR-20 | Home view across all of a person's committees | US-22 | Must |
| FR-21 | Privacy page linked from the footer, sign-up and member link page | US-23 | Must |
| FR-22 | "How it's built" page in the top bar | US-24 | Must |
| FR-23 | Amount display setting (two formats, grouping); amounts stored as whole rupees | US-2 | Should |
| FR-24 | Optional member email reminders when the organiser enters an email and turns it on | US-16 | Should |

### Non-functional

| ID | Requirement | Measure |
|---|---|---|
| NFR-1 | Phone-first: every screen designed and tested at 375 px and on a OnePlus 7 | Phone project in system tests; manual check |
| NFR-2 | Recording a payment takes under 20 seconds on a phone | Stopwatch |
| NFR-3 | WCAG 2.2 AA: contrast measured by a unit test, keyboard use, visible focus, reduced motion | Unit test, audit |
| NFR-4 | Works in the user's real setup: browser zoom 80-125%, classic scrollbars, short windows | Real-setup test project |
| NFR-5 | Security: row-level security on every table; explicit grants; member and receipt data only through database functions that return the caller's own rows; numbered migrations that are never edited after they have run; receipts private; each role tested | Role-check script |
| NFR-6 | History can't be changed by update or delete | Database test |
| NFR-7 | Installable on Android as a web app | Manual check on OnePlus 7 |
| NFR-8 | Print and PDF keep the app's design | System test |
| NFR-9 | Dates and due days use Pakistan time (UTC+5) | Unit tests around month ends |
| NFR-10 | The daily job is idempotent | Run twice; no duplicate reminders |
| NFR-11 | Pages load in 3 s or less on a throttled mobile connection (to be measured on the deployed site) | Measured |

## 7. Constraints and assumptions

Stack: Next.js and TypeScript, Supabase, Vercel. Free tiers only. No money handled. Assumptions are listed in the business rules with the tag [A] and are removed one by one as R1 or other organisers confirm them.

## 8. Success criteria and acceptance

The release is acceptable when: all Must requirements pass their tests; the role-check script and history tests pass; R1's real committee (names changed) matches her notebook; the live-site system tests pass; and the README and deployment are complete.
