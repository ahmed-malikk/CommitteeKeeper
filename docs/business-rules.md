# Business rules: CommitteeKeeper (v0.2, 15 October 2026)

**Status:** approved by the product owner for build. R1 is the one organiser who answered questions; no real names appear here.
**Source tags:** **[R1]** confirmed by the real organiser (some by blanket yes, marked) · **[Std]** standard kameti practice · **[A]** assumption, not yet checked with an organiser. Each [A] is confirmed or changed as organisers answer.

## 1. Words

- **Committee:** one kameti group with a fixed amount, number of periods and set of slots.
- **Period:** one payment round (default one month).
- **Slot:** one turn in the cycle. A committee has N slots and N periods; each slot receives the pot exactly once. **[Std][R1]**
- **Member:** a person in the committee. A member can hold **several slots**, each treated as a normal slot under the same name. **[R1]**
- **Holder:** whoever owns a slot during a stretch of periods. A slot can have several holders over time (replacement). **[R1]**
- **Pot:** amount x N (every slot pays the amount each period; the pot goes to the slot whose turn it is). **[Std][R1]**
- **Organiser:** the person who runs the committee; may also be a member and hold slots. **[R1]**

## 2. Money rules (the app calculates, never moves money)

| # | Rule | Source |
|---|---|---|
| M1 | Each slot owes the amount every period. A member's dues per period = amount x slots held. | [R1][A] formula |
| M2 | The pot for the slot whose turn it is = amount x N. | [Std][R1] |
| M3 | A slot's first turn is its only turn; a paid-out turn is locked and can't change. | [R1] |
| M4 | The app records who paid, when, how and an optional note. Methods offered: **cash, bank deposit/transfer, Easypaisa, JazzCash, other** (members use all of them). The organiser can attach receipt screenshots (section 8b). | [R1] methods and screenshots |
| M5 | Members pay the **full instalment** due each period; a period is paid or pending. No part payments. | [R1] |
| M6 | A payment is **late** if recorded after the due day plus the grace days the organiser set (default 0). The app shows "late by N days". It adds no fee. | [A], R1 says some pay weeks late |

## 3. Turn order

| # | Rule | Source |
|---|---|---|
| O1 | The organiser chooses per committee how turns are decided: **set by hand**, **draw all turns at the start**, or **draw each month**. | [R1] |
| O2 | A draw can be redone. The old result stays visible; the new one supersedes it. | [R1] |
| O3 | The organiser can change the sequence by hand at creation or later, and can switch the mode mid-way. | [R1] |
| O4 | Turns already paid out are locked in every case. | [R1] |
| O5 | Every draw and every order change is a logged entry with the date, who did it and an optional reason. All members see it. | [A], fits [R1] "transparent" |
| O6 | Draws use the server's secure random number generator. The result is shown to all members. | [A] |
| O7 | Bidding is not supported. | out of scope |

## 4. Swaps

| # | Rule | Source |
|---|---|---|
| S1 | Two slots that have **not yet been paid out** can swap their turns if both holders agree. The organiser records it as one entry (both slots, old and new turns, reason). | [R1] swaps happen; rest [A] |
| S2 | After a swap the app updates the payout schedule and shows each member the new payout month. | [A], fits [R1] |
| S3 | **A swap does not change any money amount.** Instalments stay equal; only the payout months change. | [R1] confirmed |

## 5. Leaving and replacing

| # | Rule | Source |
|---|---|---|
| L1 | A member who has **not yet received** the pot (for that slot) leaves. The organiser finds a **replacement who takes the slot from the next period** and pays the remaining periods. | [R1] |
| L2 | When that slot's turn comes, **the leaver receives what they contributed and the replacement receives the rest of the pot**. Example: 12 slots at Rs 1,000. Ali paid periods 1-3 (Rs 3,000) and leaves; Sara takes periods 4-12 (9 periods, Rs 9,000). The pot is Rs 12,000: Ali Rs 3,000, Sara Rs 9,000. | [R1] example confirmed |
| L3 | The split uses the periods each holder is responsible for over the **whole cycle** (3 and 9), even if the slot's turn comes before Sara has paid all 9 (for example in period 7 she has paid 4 so far). Sara's other 5 payments come after the turn, as for any member who is paid early. | [R1] confirmed with the period-7 example |
| L4 | A member who **has already received** the pot leaves or stops paying: the replacement takes over the remaining payments; what the leaver still owes is shown on their statement and settled outside the app. | [R1] yes |
| L5 | In a month-by-month draw committee, a leaver who hasn't been drawn is settled the same way as L2: replacement joins the pool, the slot's pot is split by periods each was responsible for. | [R1] yes |
| L6 | Every leave and replacement is one logged entry linking leaver, replacement, first period of the replacement. | [A] |
| L7 | Before the committee starts (forming) members can simply be removed; after it starts only L1-L5 apply. | [A] |

## 6. Status (state machine)

States: **forming -> running -> completed.** No other moves, no going back. (A "cancelled" state is not in v1. **[A]**, ask organisers.)

| From -> To | Who | Guards (all must be true) |
|---|---|---|
| forming -> running | organiser | at least 2 slots; amount > 0; number of periods = number of slots; start date set; every slot has a holder; turn order set (hand or start-draw done) OR mode = draw each month |
| running -> completed | organiser | the last period has passed; every period's payments are paid or have an explicit settlement entry; every slot has been paid out (payout recorded) |
| any other move | nobody | rejected with a clear reason (for example "A committee can't be completed before it has started") |

| State | Allowed |
|---|---|
| forming | add/remove members and slots, edit settings, set order, draw, invite members |
| running | record payments, draw or redo (future turns only), manual order change (future turns only), swap, leave/replace, record payouts, send reminders. **Amount, number of periods and start date are fixed.** [A] |
| completed | **read only** (product owner's reasoning; not yet asked of an organiser). Corrections are not possible. |

## 7. The history (append-only log)

- Nothing in the history is edited or deleted, by anyone, including the organiser and the database admin. A mistake is fixed by a **correction entry** that points to the original; both stay visible. **[Std in banking terms][R1 transparency]**
- Every entry has: id, committee, type, who, when, details, reference to a previous entry if any, and the hash of the previous entry (so a missing or changed entry shows up).
- Entry types (draft): committee_created · settings_set · agreement_accepted · member_invited · member_joined · slot_added · order_set · draw_done · draw_redone · committee_started · payment_recorded · payment_claimed · payment_confirmed · payment_corrected · receipt_attached · receipt_removed · turn_swapped · holder_replaced · payout_recorded · reminder_sent · committee_completed.
- Only the organiser can read the full history. A member sees only the entries about themselves (their own payments, receipts and turns) and nothing about anyone else. **[product owner: as secure as possible]**

## 8. Roles (changed 15 Oct: the organiser does everything; members are optional)

**Principle [R1]:** the committee must work completely without any member using the app. Every action is done by the organiser. Many of R1's members would not use an app, and a member who can't use a button must not disturb the workflow.

| Role | Can |
|---|---|
| Organiser (signs in with email) | everything in section 6; record payments for any member; run draws; swap; replace; record payouts; send reminders; choose what members can see (section 8a) |
| Member (optional) | open a **private link** the organiser shares (no account needed) and see: **when is my draw**, **how many months are left**, **the status of the committee**. Nothing else by default. |
| Member with an account (optional, email sign-up/sign-in, **in v1**) | view only: the same three things for every committee they belong to, in one place. Nothing needs them to sign in. **[product owner]** |
| Anyone else | nothing |

- Members do **not** report payments in v1. "I paid" by the member is a v1.1 candidate. **[product owner's decision]**
- A person can be organiser in some committees and a member in others (R1 runs 3-4 and is a member in all of them). **[R1]**
- Members never see each other's email addresses or phone numbers. **[A]**

### 8a. What members can see (organiser-controlled)

| Setting | Default | Source |
|---|---|---|
| Members can see **who has paid / payment status** | **Off.** Members can't see payment information at all unless the organiser switches it on. | product owner |
| Members can see **whose turn it is** (who receives which month) | **Off.** The organiser can allow it in settings. A member always sees their own turn. The pot amount is known to everyone (amount x slots). | [R1] |
| Members can see the committee **history log** | Off. **[A]** | [A] |

The member's own statement (their draw, months left, status) is always visible to them on their link or account.

**How a member gets in [A]:** the organiser adds the member (name; email or phone optional, only for the organiser's use). The organiser gets a private link per member. Opening the link shows the member's view with no account. A member can also sign up with email and attach their account to that link, after which they see all their committees together. A link can be turned off by the organiser. Sign-up is view-only and never required.

## 8b. Receipt screenshots (a key feature, in v1)

| # | Rule | Source |
|---|---|---|
| P1 | When recording a payment, the organiser can attach one or more receipt screenshots (wallet or bank app). | [R1] members send them to her on WhatsApp; stored, a key feature |
| P2 | Images only (JPEG, PNG, WebP), **up to 2 per payment** (R1: 1-2 is fine). The phone resizes large images before upload. File-size limit [A] | [R1], [A] |
| P3 | Receipts are stored privately and shown only through short-lived links. The organiser sees all. **A member sees their own payment history and their own receipts, and nobody else's** (R1). The "payment information" setting (off by default) controls whether members see **other** members' payment status. **A member sees only their own payments, receipts, history and committees, and no information about anyone else.** | [R1]; **confirmed by the product owner** ("as secure as possible") |

**Security principle for members:** a member's screens get their data only from database functions that return that member's own rows. Members have no direct access to any table or to the storage bucket.
| P4 | Each attached receipt is a history entry holding a fingerprint (hash) of the file, so a receipt can't be swapped later without it showing. | [A], fits append-only |
| P5 | A wrongly attached receipt is not silently edited. Removing one adds a "receipt removed" entry (who, when, why); the image is deleted from storage but the entry and its fingerprint stay. | [A], balances privacy and the record |
| P6 | Receipts contain private financial details. They never appear in public docs, screenshots or tests; tests use made-up images. | privacy rule |

## 9. The committee agreement

The settings chosen at creation (amount, number of periods, start date, due day, grace days, order method, reminder days, what members can see, **how amounts are displayed**) are saved as the committee's written agreement. Amount display is a setting with two choices (for example "Rs 12,000" and "Rs. 12,000/-", and Western or lakh digit grouping); amounts are stored as whole rupees and only the display changes. **[product owner]** The organiser can share it with members (shown on the member link and printable). The organiser can record that a member has agreed to it; members are not required to use the app to agree. **[Std: written agreement recommended][A]**

## 10. Reminders

| # | Rule | Source |
|---|---|---|
| R1 | A daily scheduled job finds payments that are due soon, due today or late. | plan |
| R2 | Defaults: 2 days before, on the due day, then every 3 days while late. The organiser can change these. | [A] |
| R3 | The **organiser** gets a daily summary (in the app and by email to the organiser's own address) with the longest-late first. For each pending member the app prepares a ready-to-send WhatsApp message (an ordinary WhatsApp link with the text filled in, no paid service). Members get an email reminder only if the organiser entered their email and switched it on. | [R1] uses WhatsApp, members may not use the app, [A] |
| R4 | A reminder is sent at most once per member, period and kind (idempotent) and is logged. | design |

## 11. Out of scope in v1

Moving money · automatic fines or fees · bidding · automatic WhatsApp/SMS · phone-number sign-in (later, needs SMS cost) · multiple currencies · Urdu screens · native Android app (installable web app instead).

## 13. Committees that are already running, and backdated entries 

R1's committees are already under way. To try the demo she must enter a committee that started months ago, so the app can't assume everything begins in "forming".

| # | Rule | Source |
|---|---|---|
| B1 | A committee can be created with a start date in the past ("already running"). The organiser enters its members, slots, order (including turns already paid out) and past payments, then it opens as **running**. | [A] |
| B2 | Every history entry stores two times: **when it happened** (the date the organiser says, e.g. paid on the 3rd) and **when it was recorded** (set by the system, can't be changed). Entries made to catch up are marked "recorded later". | [A], fits append-only |
| B3 | Past turns entered this way are locked like any paid-out turn. | [R1] A6 |
| B4 | The organiser can enter several past months in one go; each becomes its own entry. | [A] |
| B5 | Times and due dates use Pakistan time (UTC+5). | [A] |

## 12. Open questions

1. A "cancelled" state is not in v1; to ask organisers.
2. The receipt removal rule (P5) and the member-link and account attachment (section 8a): to check with organisers on the running prototype.
3. Whether a leaver who already received the pot (L4) and a leaver in a month-by-month draw (L5) are settled as written: the organiser said yes in general; each needs a worked example.
4. Whether the draw mode may change after the committee starts (implemented as allowed, per O3).
5. That period 1 falls in the month of the start date, due on the due day.

Decided by the product owner: the member account (view only) and the personal link are both in v1; receipt screenshots are stored in v1; payment information is hidden from members unless the organiser switches it on; a completed committee is read-only.

Closed with the organiser (R1): the leaver split timing (L3), swaps change no amounts (S3), full instalments only (M5), payment methods (M4), and that the "recalculation hassle" on swaps was only about the payout schedule.
