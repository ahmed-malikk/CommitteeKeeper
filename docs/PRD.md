# PRD: CommitteeKeeper

**Author:** Ahmed Malik · **Date:** 15 October 2026 · **Status:** approved for build · **Related:** [Business rules](business-rules.md) · [BRD](BRD.md)

## 1. Problem

Savings committees (known as *kameti* or *BC*) are run on a notebook and a WhatsApp group. One person, the organiser, collects the same amount from every member each month, hands the whole pot to one member, and repeats until everyone has had a turn. The organiser runs several at once, is usually a member too, and keeps everything by hand: who has paid, who is late (sometimes by weeks), whose turn it is, and what happens when two people swap turns, a member leaves, or a replacement joins. A small mistake in the notebook becomes an argument, and the proof of payment is a screenshot buried in a chat.

**Evidence:** one organiser (R1) who runs 3 or 4 committees and is a member in all of them. She answered questions in five rounds of conversation with the product owner, covering how her committees work, how members pay (cash, bank deposit, Easypaisa, JazzCash), how draws are done (by hand and at random, at the start or every month), what happens when a member leaves, and that members already send her payment screenshots. No formal interviews have been held, and no member has been consulted directly. Claims in this document come from R1 or are marked as assumptions.

## 2. Target users

**Primary: the organiser.** Runs one or more committees, usually on an Android phone, and does everything: sets up, collects, records, draws, chases. The app must work completely without any member ever opening it.

**Secondary: the member (optional).** Pays monthly and receives the pot in their turn. Most members will not use an app. What they ask the organiser: when is my draw, how many months are left, what is the committee's status. A private link or a view-only account answers those.

## 3. Goals and non-goals

**Goals**
- One record per committee that the organiser trusts and can show: who paid what, when, and with which receipt.
- A history that nobody can quietly change (corrections are new entries).
- The calculations R1 does by hand are done by the app: payout turns, swaps, leavers and replacements, and who is late.
- All of the organiser's committees in one place.
- Members can find their own answers without asking.

**Non-goals (v1)**
- Moving or holding money, payment processing, automatic fines or fees.
- Bidding for turns.
- Sending WhatsApp or SMS automatically (the app prepares the message; the organiser sends it).
- Phone-number sign-in (needs a paid SMS service), Urdu screens, multiple currencies.
- A native Android app. The web app is installable on Android instead.
- Members reporting their own payments (candidate for v1.1).

## 4. MVP: five features, in build order

| # | Feature | Includes |
|---|---|---|
| 1 | **Set up and run a committee** | Sign-up and sign-in (organiser); settings and written agreement; members and slots (a member can hold several); turn order by hand, by a start draw or by a monthly draw, with redo; status forming, running, completed; starting a committee that is already running (backdated entries); swaps, leavers and replacements; home view across all committees |
| 2 | **Payments and receipts** | Record a payment (amount, date, method, note); up to 2 receipt screenshots; pending and late list; per-period grid; payouts and the leaver/replacement split |
| 3 | **History** | Append-only log of every change; corrections as new entries; readable by the organiser |
| 4 | **Reminders** | Daily scheduled check; organiser summary (in the app and by email); a ready-to-send WhatsApp message per pending member |
| 5 | **Member access** | Private link per member; optional view-only account; what members see, controlled by the organiser; own payment history and receipts; privacy page |

Two supporting pages are part of the product but not counted as features: the privacy page and "How it's built" (US-23, US-24).

Only if the schedule slips, and only by the product owner's decision, the order of cutting is: the optional member account (feature 5) first, then member emails (feature 4), then the display-format options. The README and the deployment are never cut.

## 5. User stories

Build order = row order. Each story becomes a GitHub issue with these criteria. "Rule" points to the business rules document.

| # | As a… | I want to… | So that… | Acceptance criteria | Rule |
|---|---|---|---|---|---|
| US-1 | organiser | sign up and sign in with email | my committees are only mine | Valid email and password create an account; a wrong password gives the real reason; a signed-out visitor can't open any committee page; works at 375 px | §8 |
| US-2 | organiser | create a committee with its settings | the rules are written down once | I set name, amount, number of periods, start date, due day, grace days, order method, reminder days, display format and what members can see; the settings are saved as the committee's agreement; an empty name or amount 0 is refused with a clear message | §9, 8a |
| US-3 | organiser | add members and give each one or more slots | the pot and the turns are right | Pot = amount x slots; a member with two slots shows two turns and two instalments; long names and Urdu-script names fit; 2 to 30 slots | §1, M1 |
| US-4 | organiser | set the turn order by hand | I can follow my group's agreed order | Dragging or setting positions saves; every slot has one position; turns already paid out can't move | O1, O3, O4 |
| US-5 | organiser | run a draw, at the start or each month, and redo it | turns are decided fairly and visibly | The draw uses the server's secure random; the result and time are recorded; a redo keeps the old result visible; I can switch the mode later; paid-out turns are excluded | O1-O6 |
| US-6 | organiser | start a committee, new or already running | I can use the app with my real committees | Starting needs the guards in §6 (at least 2 slots, amount, start date, every slot held, order set or monthly draw); an already-running committee accepts past payments and past turns, each entry showing when it happened and when it was recorded | §6, B1-B5 |
| US-7 | organiser | record a payment | the record shows who paid | I choose member/slot, period, date and method (cash, bank, Easypaisa, JazzCash, other) and add a note; the full instalment only; I can record it in under 20 seconds on a phone (to be measured) | M4, M5 |
| US-8 | organiser | attach 1 or 2 receipt screenshots to a payment | the payment has its proof | JPEG, PNG or WebP only; more than 2 refused; large images are shrunk; stored privately; each attachment is a history entry with a fingerprint; removing one adds an entry and deletes the file | P1-P6 |
| US-9 | organiser | see who is pending and who is late | I know whom to chase | A list sorted by longest late with "late by N days"; a per-period grid of all slots; the numbers agree everywhere they appear | M6 |
| US-10 | organiser | swap two turns | an agreed swap is recorded | Only unpaid-out turns; both slots change position in one entry with a reason; no amount changes | S1-S3 |
| US-11 | organiser | record that a member leaves and who replaces them | the split is calculated, not guessed | The replacement takes the slot from the next period; when the slot's turn comes the pot is split: leaver the periods they paid, replacement the rest (example: 3 and 9 of 12 give Rs 3,000 and Rs 9,000 at Rs 1,000); also works after the pot was received and in a monthly-draw committee | L1-L6 |
| US-12 | organiser | record that a pot was handed over | the cycle completes truthfully | The turn is marked paid out and locked; the pot amount and split are stored | M3 |
| US-13 | organiser | correct a mistake | the record stays honest | The original stays visible; a correction entry points to it; nothing is edited or deleted | §7 |
| US-14 | organiser | read the full history | I can show it in a dispute | Every entry shows type, who, when it happened, when it was recorded, details and receipts; a missing or changed entry is detected by the chain check | §7 |
| US-15 | organiser | complete a committee | the cycle ends cleanly | Only after the last period has passed and every turn is paid out; a committee that has not started can't be completed (clear message); afterwards it is read only | §6 |
| US-16 | organiser | get a daily summary and ready-to-send messages | I stop chasing by memory | A daily job lists who is due soon, due today and late; the summary is in the app and emailed to me; each pending member has a prepared WhatsApp message; running the job twice sends nothing twice | R1-R4 |
| US-17 | organiser | give a member a private link | members can look without an account | Each member has their own link; I can turn a link off; the link shows only that member's view | §8, 8a |
| US-18 | member | open my link and see when my draw is, how many months are left and the committee's status | I don't have to ask | Shows my turn(s), months left and status; shows other members' turns only if the organiser allowed it; shows no one else's payments; works at 375 px | §8a |
| US-19 | member | sign up and sign in to see my committees in one place | I have one place to look | Optional; view only; attaches to my link; shows only my committees; sign-out ends this device's session only | §8a |
| US-20 | member | see my own payments and receipts | I have my own proof | Only my own; never another member's | P3 |
| US-21 | organiser | choose what members can see | I control my group's privacy | Settings for other members' payment status (off by default), whose turn it is (off by default); changes take effect on all screens | §8a |
| US-22 | organiser | see all my committees on one home screen | I can run 3 or 4 without confusion | Each committee shows its status, what is due this month and what is overdue; a person who is a member somewhere and organiser elsewhere sees both | §8, R1 |
| US-23 | anyone | read a privacy page | I know what is stored | A page linked from the footer (account menu on phone), at sign-up and on the member link page | §8b |
| US-24 | visitor | open "How it's built" from the top bar | I can see who made it and how | Personal story, problem, stack, architecture, tests, links, credits | project rule |

## 6. Success metrics

Targets are proposed here and fixed before the trial; results are real numbers only.

| Metric | Target (proposed) | How measured |
|---|---|---|
| R1's real committee entered and the totals match her notebook | 0 mismatches | Side-by-side check, with her notebook as the reference |
| Time to record one payment on a phone | under 20 seconds | Stopwatch on a OnePlus 7 with R1 |
| R1 completes setting up a committee without help | yes/no, with notes | Observed (or described by R1) |
| Time R1 spends chasing late payers in a month, before and after | a reduction she reports | R1's own account; labelled as reported |
| Daily reminder job on the deployed site | runs once a day, no duplicates | Run log |
| Accessibility | WCAG 2.2 AA contrast, checked by a unit test | Automated |

## 7. Risks

| Risk | Mitigation |
|---|---|
| Wrong calculation for leavers and replacements | Rules confirmed by R1 with a worked example; the examples become the first unit tests |
| Receipt images hold private financial details | Private storage, short-lived links, only the people allowed, made-up images in tests, a privacy page |
| Free email services may not send to arbitrary members | Organiser summary goes to the organiser's own address; members' email is optional; WhatsApp message prepared for the organiser to send |
| Scope is large (draws, recalculation, receipts, member accounts) | Five features in a fixed order; the plan and a clickable prototype approved before building |
| Only one organiser's evidence | Claims limited to what R1 said; other organisers asked to try the demo |
| People may misread the app as handling money | Said plainly on the home page, the agreement and the privacy page: it only keeps the record |
| Real-setup bugs (zoom, scrollbars, print, phones) | A written checklist of past failures; a real-setup test project from the first screen |
