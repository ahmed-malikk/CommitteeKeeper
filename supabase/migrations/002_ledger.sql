-- CommitteeKeeper 002_ledger: the history ("ledger") that can never be changed.
-- Run once, in order, in the Supabase SQL Editor (see supabase/README.md). A migration that has been run is never edited.
-- Never edit this file after it has been run; changes go in a new numbered file.
--
-- What is here:
--   ledger_events   one row per thing that ever happened in a committee (append-only)
--   ledger_hash()   the one formula that makes each entry's fingerprint
--   triggers        number each entry, chain it to the one before, and refuse any change or delete
--   verify_chain()  recomputes the whole chain and says where it breaks, if it does
--
-- Honest limit (goes in the README): the chain shows that nothing was QUIETLY changed by the app
-- or a normal database user. Someone with full admin control of the database could rebuild the
-- whole chain, and the newest entries could be removed without a gap showing. Tamper-evident,
-- not tamper-proof.

-- ── The table ────────────────────────────────────────────────────────────────

create table public.ledger_events (
  id                 uuid primary key default gen_random_uuid(),
  committee_id       uuid not null references public.committees (id),
  seq                integer not null,        -- 1, 2, 3 ... per committee; set by the trigger, never by the app
  type               text not null check (type in (
    'committee_created', 'settings_set', 'agreement_accepted', 'member_invited', 'member_joined',
    'member_removed', 'member_updated', 'slot_added', 'slot_removed', 'order_set', 'draw_done', 'draw_redone', 'committee_started',
    'payment_recorded', 'payment_claimed', 'payment_confirmed', 'payment_corrected',
    'receipt_attached', 'receipt_removed', 'turn_swapped', 'holder_replaced',
    'payout_recorded', 'reminder_sent', 'committee_completed'
  )),
  actor_id           uuid references public.profiles (id),   -- who did it; null only for the daily job
  happened_on        date not null,           -- what the organiser says (backdating is allowed)
  recorded_at        timestamptz not null,    -- the database clock; set by the trigger, never by the app
  payload            jsonb not null default '{}'::jsonb,       -- the details of this entry
  corrects_event_id  uuid references public.ledger_events (id),-- set when this entry corrects an earlier one
  prev_hash          text not null,           -- fingerprint of the entry before (set by the trigger)
  hash               text not null,           -- this entry's fingerprint (set by the trigger)
  unique (committee_id, seq)
);

create index ledger_events_committee_idx on public.ledger_events (committee_id, seq);

alter table public.ledger_events enable row level security;

-- The organiser may READ the history of their own committees. Nobody can write directly.
grant select on public.ledger_events to authenticated;

create policy "Organisers can read the history of their committees"
  on public.ledger_events for select to authenticated
  using (public.is_organiser(committee_id));

-- Belt: no role is given any way to change the table. (The functions in 004 insert as the table's
-- owner, which is why they can still add entries.)
revoke insert, update, delete, truncate on public.ledger_events from public, anon, authenticated;

-- ── The fingerprint formula ──────────────────────────────────────────────────
-- The same formula must exist in TypeScript (ledger.ts, learning task 9), and one test compares them.
-- Input is these fields joined with "|", in this order:
--   prev_hash | seq | type | actor_id (empty if none) | happened_on (YYYY-MM-DD)
--   | recorded_at in UTC as YYYY-MM-DDTHH:MI:SS.UUUUUUZ | payload as Postgres writes it (payload::text)
-- Note for the TypeScript side: Postgres stores jsonb with its keys in a fixed order (shorter keys
-- first, then alphabetical), so the TypeScript test must write the payload in that same order.

create function public.ledger_hash(
  p_prev_hash text, p_seq integer, p_type text, p_actor uuid,
  p_happened_on date, p_recorded_at timestamptz, p_payload jsonb
) returns text
language sql immutable set search_path = '' as $$
  select encode(
    extensions.digest(
      concat_ws('|',
        p_prev_hash,
        p_seq::text,
        p_type,
        coalesce(p_actor::text, ''),
        to_char(p_happened_on, 'YYYY-MM-DD'),
        to_char(p_recorded_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        p_payload::text
      ),
      'sha256'
    ),
    'hex'
  );
$$;

-- ── Triggers: number, chain, and refuse changes ──────────────────────────────

-- Runs before every INSERT. Whatever the caller sent for seq, recorded_at, prev_hash and hash is
-- thrown away and replaced with the real values.
create function public.ledger_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_last public.ledger_events;
begin
  -- Lock this committee's row so two entries made at the same moment cannot get the same number.
  perform 1 from public.committees where id = new.committee_id for update;

  select * into v_last from public.ledger_events
   where committee_id = new.committee_id order by seq desc limit 1;

  if v_last.id is null then
    new.seq := 1;
    new.prev_hash := 'GENESIS';
  else
    new.seq := v_last.seq + 1;
    new.prev_hash := v_last.hash;
  end if;

  -- A correction must point at an entry of the same committee.
  if new.corrects_event_id is not null and not exists (
    select 1 from public.ledger_events
     where id = new.corrects_event_id and committee_id = new.committee_id
  ) then
    raise exception 'A correction must point to an earlier entry of the same committee';
  end if;

  new.recorded_at := clock_timestamp();
  new.hash := public.ledger_hash(
    new.prev_hash, new.seq, new.type, new.actor_id, new.happened_on, new.recorded_at, new.payload
  );
  return new;
end;
$$;

create trigger ledger_before_insert
  before insert on public.ledger_events
  for each row execute function public.ledger_before_insert();

-- Suspenders: even if someone later grants UPDATE or DELETE by mistake, these still refuse.
create function public.ledger_refuse_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'The history cannot be changed or deleted. Add a correction entry instead.';
end;
$$;

create trigger ledger_no_update_delete
  before update or delete on public.ledger_events
  for each row execute function public.ledger_refuse_change();

create trigger ledger_no_truncate
  before truncate on public.ledger_events
  for each statement execute function public.ledger_refuse_change();

-- ── Checking the chain ───────────────────────────────────────────────────────

-- Returns 'ok', or says where the first problem is. Only the committee's organiser can ask.
create function public.verify_chain(p_committee_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.ledger_events;
  v_expected_seq integer := 1;
  v_prev_hash text := 'GENESIS';
begin
  if not public.is_organiser(p_committee_id) then
    raise exception 'Not allowed';
  end if;

  for r in
    select * from public.ledger_events where committee_id = p_committee_id order by seq
  loop
    if r.seq <> v_expected_seq then
      return 'broken at entry ' || v_expected_seq || ': an entry is missing';
    end if;
    if r.prev_hash <> v_prev_hash then
      return 'broken at entry ' || r.seq || ': it does not follow the entry before';
    end if;
    if r.hash <> public.ledger_hash(
      r.prev_hash, r.seq, r.type, r.actor_id, r.happened_on, r.recorded_at, r.payload
    ) then
      return 'broken at entry ' || r.seq || ': its contents were changed';
    end if;
    v_prev_hash := r.hash;
    v_expected_seq := v_expected_seq + 1;
  end loop;

  return 'ok';
end;
$$;

revoke execute on function public.verify_chain(uuid) from public, anon;
grant execute on function public.verify_chain(uuid) to authenticated;

-- The other functions are only for the triggers; nobody calls them directly.
revoke execute on function public.ledger_hash(text, integer, text, uuid, date, timestamptz, jsonb) from public;
revoke execute on function public.ledger_before_insert() from public;
revoke execute on function public.ledger_refuse_change() from public;
