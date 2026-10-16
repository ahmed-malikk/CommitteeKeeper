-- CommitteeKeeper 004b: organiser functions for money records (part 2 of 3 of migration 004).
-- Run once, in order, in the Supabase SQL Editor (see supabase/README.md). A migration that has been run is never edited.
--
-- Same idea as 004a: each function checks who is asking and the committee's status, changes the data
-- and writes the history entry in the same step. The app never moves money; these only RECORD it.
--
-- Functions here:
--   record_payment, correct_payment, attach_receipt, remove_receipt, record_payout
-- All of them need the committee to be RUNNING (a forming committee has no payments yet, and a completed
-- one is read-only).

-- ── Record a payment ─────────────────────────────────────────────────────────

create function public.record_payment(
  p_committee_id uuid, p_slot_id uuid, p_period smallint,
  p_paid_on date, p_method text, p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c public.committees;
  v_member uuid;
  v_id uuid;
begin
  c := public.ck_lock(p_committee_id, array['running']);

  if not exists (select 1 from public.slots where id = p_slot_id and committee_id = p_committee_id) then
    raise exception 'That slot is not in this committee';
  end if;
  if p_period < 1 or p_period > c.periods then
    raise exception 'Period must be between 1 and %', c.periods;
  end if;
  if p_paid_on > public.ck_today() then
    raise exception 'The payment date cannot be in the future';
  end if;

  -- The payer is whoever holds the slot in that period (Ali for periods 1-3, Sara for 4-12).
  select h.member_id into v_member
    from public.slot_holders h
   where h.slot_id = p_slot_id
     and h.from_period <= p_period
     and (h.to_period is null or h.to_period >= p_period);
  if v_member is null then raise exception 'Nobody holds that slot in period %', p_period; end if;

  -- One counted payment per slot and period (a mistake is fixed with correct_payment instead).
  if exists (select 1 from public.payments_current
              where slot_id = p_slot_id and period = p_period) then
    raise exception 'A payment is already recorded for that slot and period; correct it instead';
  end if;

  -- Full instalment only (rule M5): the amount is always the committee's amount, never typed in.
  insert into public.payments (committee_id, slot_id, member_id, period, amount, paid_on, method, note)
  values (p_committee_id, p_slot_id, v_member, p_period, c.amount, p_paid_on, p_method, nullif(btrim(p_note), ''))
  returning id into v_id;

  -- The history gets no note text (notes can be private).
  perform public.ck_log(p_committee_id, 'payment_recorded', p_paid_on,
    jsonb_build_object('payment_id', v_id, 'slot_id', p_slot_id, 'member_id', v_member,
                       'period', p_period, 'amount', c.amount, 'method', p_method));
  return v_id;
end;
$$;

-- ── Correct or cancel a payment (decision 3: a new row, the old one stays) ───

create function public.correct_payment(
  p_committee_id uuid, p_payment_id uuid, p_paid_on date, p_method text,
  p_note text default null, p_cancel boolean default false, p_reason text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  old public.payments;
  v_id uuid;
  v_orig_event uuid;
begin
  perform public.ck_lock(p_committee_id, array['running']);

  -- Only a payment that currently counts can be corrected.
  select * into old from public.payments_current where id = p_payment_id and committee_id = p_committee_id;
  if old.id is null then raise exception 'That payment was not found, or it was already corrected'; end if;
  if p_paid_on > public.ck_today() then raise exception 'The payment date cannot be in the future'; end if;

  insert into public.payments (committee_id, slot_id, member_id, period, amount, paid_on, method, note,
                               corrects_payment_id, voided)
  values (old.committee_id, old.slot_id, old.member_id, old.period, old.amount, p_paid_on, p_method,
          nullif(btrim(p_note), ''), old.id, coalesce(p_cancel, false))
  returning id into v_id;

  -- Point the new history entry at the latest entry about the old payment.
  select e.id into v_orig_event
    from public.ledger_events e
   where e.committee_id = p_committee_id and e.payload ->> 'payment_id' = old.id::text
   order by e.seq desc limit 1;

  perform public.ck_log(p_committee_id, 'payment_corrected', p_paid_on,
    jsonb_build_object('payment_id', v_id, 'corrects_payment_id', old.id, 'slot_id', old.slot_id,
                       'member_id', old.member_id, 'period', old.period, 'amount', old.amount,
                       'method', p_method, 'cancelled', coalesce(p_cancel, false),
                       'reason', nullif(btrim(p_reason), '')),
    v_orig_event);
  return v_id;
end;
$$;

-- ── Receipts ─────────────────────────────────────────────────────────────────
-- The browser first uploads the (shrunk) image to the private storage bucket (migration 006), then calls
-- this to register it. The database checks the type, size, and that at most 2 are attached.

create function public.attach_receipt(
  p_committee_id uuid, p_payment_id uuid, p_slot_no smallint,
  p_storage_path text, p_sha256 text, p_mime text, p_size_bytes integer
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform public.ck_lock(p_committee_id, array['running']);

  if not exists (select 1 from public.payments_current where id = p_payment_id and committee_id = p_committee_id) then
    raise exception 'That payment was not found, or it was corrected';
  end if;
  -- The file must sit in this committee's and this payment's own folder.
  if p_storage_path not like (p_committee_id::text || '/' || p_payment_id::text || '/%') then
    raise exception 'The file is not in this payment''s folder';
  end if;

  -- Type, size, the 2-per-payment limit and the fingerprint format are enforced by the table itself.
  insert into public.receipts (committee_id, payment_id, slot_no, storage_path, sha256, mime, size_bytes)
  values (p_committee_id, p_payment_id, p_slot_no, p_storage_path, p_sha256, p_mime, p_size_bytes)
  returning id into v_id;

  perform public.ck_log(p_committee_id, 'receipt_attached', public.ck_today(),
    jsonb_build_object('receipt_id', v_id, 'payment_id', p_payment_id, 'slot_no', p_slot_no,
                       'sha256', p_sha256));
  return v_id;
end;
$$;

-- Rule P5: removing does not edit history. The row is marked removed, an entry (with the file's fingerprint)
-- is added, and the server route then deletes the image file from storage using the returned path.
create function public.remove_receipt(p_committee_id uuid, p_receipt_id uuid, p_reason text default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  r public.receipts;
begin
  perform public.ck_lock(p_committee_id, array['running']);

  select * into r from public.receipts
   where id = p_receipt_id and committee_id = p_committee_id and removed_at is null;
  if r.id is null then raise exception 'That receipt was not found, or it was already removed'; end if;

  update public.receipts set removed_at = now() where id = r.id;

  perform public.ck_log(p_committee_id, 'receipt_removed', public.ck_today(),
    jsonb_build_object('receipt_id', r.id, 'payment_id', r.payment_id, 'sha256', r.sha256,
                       'reason', nullif(btrim(p_reason), '')));
  return r.storage_path;
end;
$$;

-- ── Payout: the pot is handed over ───────────────────────────────────────────
-- The app works out who gets what with the tested TypeScript function (splitPot) and passes it in as
-- p_split, for example [{"member_id": "...", "amount": 3000}, {"member_id": "...", "amount": 9000}].
-- The database does not trust it blindly: it checks every receiver really held this slot, and that the
-- amounts add up to exactly the pot.

create function public.record_payout(
  p_committee_id uuid, p_slot_id uuid, p_paid_on date, p_split jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c public.committees;
  s public.slots;
  v_pot integer;
  v_sum integer;
  v_id uuid;
begin
  c := public.ck_lock(p_committee_id, array['running']);

  select * into s from public.slots where id = p_slot_id and committee_id = p_committee_id for update;
  if s.id is null then raise exception 'That slot is not in this committee'; end if;
  if s.paid_out then raise exception 'That turn was already paid out'; end if;
  if s.position is null then raise exception 'Set the turn order for this slot first'; end if;
  if p_paid_on > public.ck_today() then raise exception 'The payout date cannot be in the future'; end if;

  v_pot := c.amount * c.periods;   -- instalment x number of slots (rule M2)

  if jsonb_typeof(p_split) <> 'array' or jsonb_array_length(p_split) = 0 then
    raise exception 'The split must list who receives what';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_split) e
     where (e ->> 'amount') is null or (e ->> 'amount')::integer <= 0
        or not exists (select 1 from public.slot_holders h
                        where h.slot_id = p_slot_id and h.member_id = (e ->> 'member_id')::uuid)
  ) then
    raise exception 'Every receiver must have held this slot and receive a positive amount';
  end if;

  select sum((e ->> 'amount')::integer) into v_sum from jsonb_array_elements(p_split) e;
  if v_sum <> v_pot then
    raise exception 'The split adds up to % but the pot is %', v_sum, v_pot;
  end if;

  insert into public.payouts (committee_id, slot_id, period, paid_on, amount, split)
  values (p_committee_id, p_slot_id, s.position, p_paid_on, v_pot, p_split)
  returning id into v_id;

  update public.slots set paid_out = true where id = p_slot_id;   -- locks the turn (rule M3)

  perform public.ck_log(p_committee_id, 'payout_recorded', p_paid_on,
    jsonb_build_object('payout_id', v_id, 'slot_id', p_slot_id, 'period', s.position,
                       'amount', v_pot, 'split', p_split));
  return v_id;
end;
$$;

-- ── Who may call these ───────────────────────────────────────────────────────

revoke execute on function public.record_payment(uuid, uuid, smallint, date, text, text) from public, anon;
revoke execute on function public.correct_payment(uuid, uuid, date, text, text, boolean, text) from public, anon;
revoke execute on function public.attach_receipt(uuid, uuid, smallint, text, text, text, integer) from public, anon;
revoke execute on function public.remove_receipt(uuid, uuid, text) from public, anon;
revoke execute on function public.record_payout(uuid, uuid, date, jsonb) from public, anon;

grant execute on function public.record_payment(uuid, uuid, smallint, date, text, text) to authenticated;
grant execute on function public.correct_payment(uuid, uuid, date, text, text, boolean, text) to authenticated;
grant execute on function public.attach_receipt(uuid, uuid, smallint, text, text, text, integer) to authenticated;
grant execute on function public.remove_receipt(uuid, uuid, text) to authenticated;
grant execute on function public.record_payout(uuid, uuid, date, jsonb) to authenticated;
