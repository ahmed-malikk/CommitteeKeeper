-- CommitteeKeeper 003_payments: payments, receipts, payouts and the reminder log.
-- Run once, in order, in the Supabase SQL Editor (see supabase/README.md). A migration that has been run is never edited.
-- Never edit this file after it has been run; changes go in a new numbered file.
--
-- What is here:
--   payments       one instalment paid (append-only; a mistake is fixed by a correction row)
--   payments_current  a view showing only the payments that count (hides corrected and cancelled ones)
--   receipts       up to 2 images per payment (the image files live in storage, see migration 006)
--   payouts        a pot handed over (append-only; locks the slot, see migration 004)
--   reminder_log   one reminder sent (the daily job can never send the same one twice)
--
-- Same security pattern as 001 and 002: row-level security on, the organiser can READ rows of their
-- own committees, nobody can write directly (the functions in 004 write), members have no table access.
-- Each table also stores committee_id so the "is this my committee?" check is one simple lookup;
-- the write functions in 004 check that it matches the slot's committee.

-- ── A shared "refuse changes" trigger function ───────────────────────────────

create function public.refuse_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'This record cannot be changed or deleted. Add a correction instead.';
end;
$$;

revoke execute on function public.refuse_change() from public;

-- ── Payments ─────────────────────────────────────────────────────────────────

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  committee_id        uuid not null references public.committees (id),
  slot_id             uuid not null references public.slots (id),
  member_id           uuid not null references public.members (id),   -- who paid (the holder of the slot that period)
  period              smallint not null check (period >= 1),
  amount              integer not null check (amount > 0),              -- whole rupees; the function checks it equals the instalment
  paid_on             date not null,                                    -- what the organiser says (backdating is allowed)
  method              text not null check (method in ('cash', 'bank', 'easypaisa', 'jazzcash', 'other')),
  note                text check (note is null or char_length(note) <= 200),
  recorded_at         timestamptz not null default now(),               -- database clock
  corrects_payment_id uuid unique references public.payments (id),      -- set when this row replaces an earlier one (decision 3); a payment can be corrected once
  voided              boolean not null default false,                   -- a correction row with voided = true cancels the payment
  check (not voided or corrects_payment_id is not null)                 -- only a correction can cancel
);

create index payments_slot_period_idx on public.payments (slot_id, period);
create index payments_committee_idx on public.payments (committee_id);

alter table public.payments enable row level security;

grant select on public.payments to authenticated;

create policy "Organisers can read payments of their committees"
  on public.payments for select to authenticated
  using (public.is_organiser(committee_id));

revoke insert, update, delete, truncate on public.payments from public, anon, authenticated;

create trigger payments_no_update_delete
  before update or delete on public.payments
  for each row execute function public.refuse_change();

create trigger payments_no_truncate
  before truncate on public.payments
  for each statement execute function public.refuse_change();

-- The payments that count: not replaced by a correction, and not cancelled.
-- security_invoker makes the view obey the same row-level security as the table.
create view public.payments_current with (security_invoker = true) as
  select p.*
    from public.payments p
   where not p.voided
     and not exists (select 1 from public.payments c where c.corrects_payment_id = p.id);

grant select on public.payments_current to authenticated;

-- Not enforced here (the write function in 004 checks it): only one current payment per slot and
-- period, and the payer must be the slot's holder for that period.

-- ── Receipts ─────────────────────────────────────────────────────────────────

create table public.receipts (
  id            uuid primary key default gen_random_uuid(),
  committee_id  uuid not null references public.committees (id),
  payment_id    uuid not null references public.payments (id),
  slot_no       smallint not null check (slot_no in (1, 2)),            -- first or second image of a payment
  storage_path  text not null,                                          -- {committee_id}/{payment_id}/{1|2}.webp
  sha256        text not null check (sha256 ~ '^[0-9a-f]{64}$'),        -- fingerprint of the file (also written to the history)
  mime          text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes    integer not null check (size_bytes > 0 and size_bytes <= 2097152),  -- decision 4: 2 MB after shrinking
  attached_at   timestamptz not null default now(),
  removed_at    timestamptz                                             -- the only column that may ever change
);

-- At most 2 images per payment. Once one is removed, its place can be used again.
create unique index receipts_payment_slot_uidx
  on public.receipts (payment_id, slot_no) where removed_at is null;

create index receipts_committee_idx on public.receipts (committee_id);

alter table public.receipts enable row level security;

grant select on public.receipts to authenticated;

create policy "Organisers can read receipts of their committees"
  on public.receipts for select to authenticated
  using (public.is_organiser(committee_id));

revoke insert, update, delete, truncate on public.receipts from public, anon, authenticated;

-- Receipts may be removed (rule P5) but nothing else about them may ever change.
create function public.receipts_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'A receipt row cannot be deleted. Remove it instead; the history keeps the record.';
  end if;
  if old.removed_at is not null then
    raise exception 'This receipt was already removed';
  end if;
  if (new.id, new.committee_id, new.payment_id, new.slot_no, new.storage_path, new.sha256,
      new.mime, new.size_bytes, new.attached_at)
     is distinct from
     (old.id, old.committee_id, old.payment_id, old.slot_no, old.storage_path, old.sha256,
      old.mime, old.size_bytes, old.attached_at) then
    raise exception 'Only the removal time of a receipt can be set';
  end if;
  return new;
end;
$$;

revoke execute on function public.receipts_guard() from public;

create trigger receipts_guard
  before update or delete on public.receipts
  for each row execute function public.receipts_guard();

create trigger receipts_no_truncate
  before truncate on public.receipts
  for each statement execute function public.refuse_change();

-- ── Payouts ──────────────────────────────────────────────────────────────────

create table public.payouts (
  id            uuid primary key default gen_random_uuid(),
  committee_id  uuid not null references public.committees (id),
  slot_id       uuid not null unique references public.slots (id),      -- a slot is paid out exactly once
  period        smallint not null check (period >= 1),
  paid_on       date not null,
  amount        integer not null check (amount > 0),                    -- the pot: instalment x number of slots
  split         jsonb not null,                                         -- who received what, e.g. Ali 3,000 and Sara 9,000
  recorded_at   timestamptz not null default now()
);

create index payouts_committee_idx on public.payouts (committee_id);

alter table public.payouts enable row level security;

grant select on public.payouts to authenticated;

create policy "Organisers can read payouts of their committees"
  on public.payouts for select to authenticated
  using (public.is_organiser(committee_id));

revoke insert, update, delete, truncate on public.payouts from public, anon, authenticated;

create trigger payouts_no_update_delete
  before update or delete on public.payouts
  for each row execute function public.refuse_change();

create trigger payouts_no_truncate
  before truncate on public.payouts
  for each statement execute function public.refuse_change();

-- ── Reminder log ─────────────────────────────────────────────────────────────

create table public.reminder_log (
  id            uuid primary key default gen_random_uuid(),
  committee_id  uuid not null references public.committees (id),
  member_id     uuid not null references public.members (id),
  period        smallint not null check (period >= 1),
  kind          text not null check (kind in ('before', 'due', 'late')),
  channel       text not null check (channel in ('app', 'email')),
  sent_on       date not null,
  -- Rule R4: the same reminder cannot be logged twice on the same day, so running the job twice
  -- cannot send twice (test TC-045).
  unique (committee_id, member_id, period, kind, channel, sent_on)
);

create index reminder_log_committee_idx on public.reminder_log (committee_id);

alter table public.reminder_log enable row level security;

grant select on public.reminder_log to authenticated;

create policy "Organisers can read the reminder log of their committees"
  on public.reminder_log for select to authenticated
  using (public.is_organiser(committee_id));

revoke insert, update, delete, truncate on public.reminder_log from public, anon, authenticated;

create trigger reminder_log_no_update_delete
  before update or delete on public.reminder_log
  for each row execute function public.refuse_change();

create trigger reminder_log_no_truncate
  before truncate on public.reminder_log
  for each statement execute function public.refuse_change();
