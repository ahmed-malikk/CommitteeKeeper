-- CommitteeKeeper 004c: organiser functions for turns, swaps, leavers and finishing (part 3 of 3 of migration 004).
-- Run once, in order, in the Supabase SQL Editor (see supabase/README.md). A migration that has been run is never edited.
--
-- Functions here:
--   set_order_method, draw_all, draw_next, swap_turns, replace_holder, complete_committee
-- Same pattern as before: check who and what state, change the data, write the history entry, all in one step.

-- ── Changing how turns are decided (rule O3) ─────────────────────────────────

create function public.set_order_method(p_committee_id uuid, p_method text, p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.ck_lock(p_committee_id, array['forming', 'running']);
  if p_method not in ('hand', 'draw_start', 'draw_monthly') then
    raise exception 'Unknown way of deciding turns';
  end if;

  update public.committees set order_method = p_method where id = p_committee_id;
  perform public.ck_log(p_committee_id, 'settings_set', public.ck_today(),
    jsonb_build_object('order_method', p_method, 'reason', nullif(btrim(p_reason), '')));
end;
$$;

-- ── Draw every turn at once (the "start draw") ───────────────────────────────
-- The database picks the order with random bytes (a secure source), not with a guessable generator.
-- Turns already paid out keep their places (rule O4). Doing it again is a redo: the old result stays
-- in the history, the new one is added (rule O2).

create function public.draw_all(p_committee_id uuid, p_reason text default null) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  c public.committees;
  v_paid integer;
  v_order uuid[];
  v_i integer;
  v_redo boolean;
begin
  c := public.ck_lock(p_committee_id, array['forming', 'running']);
  if c.order_method <> 'draw_start' then
    raise exception 'This committee does not use a start draw';
  end if;

  select count(*) into v_paid from public.slots where committee_id = p_committee_id and paid_out;

  select array_agg(id order by extensions.gen_random_bytes(16)) into v_order
    from public.slots where committee_id = p_committee_id and not paid_out;
  if v_order is null then raise exception 'There are no turns left to draw'; end if;

  update public.slots set position = null where committee_id = p_committee_id and not paid_out;
  for v_i in 1 .. array_length(v_order, 1) loop
    update public.slots set position = v_paid + v_i where id = v_order[v_i];
  end loop;

  select exists (select 1 from public.ledger_events
                  where committee_id = p_committee_id and type in ('draw_done', 'draw_redone'))
    into v_redo;

  perform public.ck_log(p_committee_id, case when v_redo then 'draw_redone' else 'draw_done' end,
    public.ck_today(),
    jsonb_build_object('order', to_jsonb(v_order), 'reason', nullif(btrim(p_reason), '')));
  return v_order;
end;
$$;

-- ── Draw the next turn (month-by-month draw) ─────────────────────────────────
-- Draws one slot, at random, from the turns that do not have a place yet, and gives it the next place.
-- p_redo = true throws away the LAST drawn turn (only if it is not paid out yet) and draws again.

create function public.draw_next(p_committee_id uuid, p_redo boolean default false, p_reason text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c public.committees;
  v_last public.slots;
  v_pick uuid;
  v_next integer;
begin
  c := public.ck_lock(p_committee_id, array['running']);
  if c.order_method <> 'draw_monthly' then
    raise exception 'This committee does not use a monthly draw';
  end if;

  if p_redo then
    select * into v_last from public.slots
     where committee_id = p_committee_id and position is not null
     order by position desc limit 1;
    if v_last.id is null then raise exception 'Nothing has been drawn yet'; end if;
    if v_last.paid_out then raise exception 'The last drawn turn was already paid out and cannot be redone'; end if;
    update public.slots set position = null where id = v_last.id;
  end if;

  select id into v_pick from public.slots
   where committee_id = p_committee_id and position is null and not paid_out
   order by extensions.gen_random_bytes(16) limit 1;
  if v_pick is null then raise exception 'There are no turns left to draw'; end if;

  select coalesce(max(position), 0) + 1 into v_next from public.slots where committee_id = p_committee_id;
  update public.slots set position = v_next where id = v_pick;

  perform public.ck_log(p_committee_id, case when p_redo then 'draw_redone' else 'draw_done' end,
    public.ck_today(),
    jsonb_build_object('slot_id', v_pick, 'position', v_next, 'reason', nullif(btrim(p_reason), '')));
  return v_pick;
end;
$$;

-- ── Swap two turns (rules S1 to S3) ──────────────────────────────────────────
-- Both turns must not be paid out yet. Only the places change; no money amount changes.

create function public.swap_turns(p_committee_id uuid, p_slot_a uuid, p_slot_b uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.slots;
  b public.slots;
begin
  perform public.ck_lock(p_committee_id, array['running']);
  if p_slot_a = p_slot_b then raise exception 'Choose two different turns'; end if;

  select * into a from public.slots where id = p_slot_a and committee_id = p_committee_id for update;
  select * into b from public.slots where id = p_slot_b and committee_id = p_committee_id for update;
  if a.id is null or b.id is null then raise exception 'Both turns must be in this committee'; end if;
  if a.paid_out or b.paid_out then raise exception 'A turn that was already paid out cannot be swapped'; end if;
  if a.position is null or b.position is null then raise exception 'Both turns must have a place before they can be swapped'; end if;

  update public.slots set position = null where id in (a.id, b.id);   -- so the two never share a place
  update public.slots set position = b.position where id = a.id;
  update public.slots set position = a.position where id = b.id;

  perform public.ck_log(p_committee_id, 'turn_swapped', public.ck_today(),
    jsonb_build_object('slot_a', a.id, 'from_a', a.position, 'to_a', b.position,
                       'slot_b', b.id, 'from_b', b.position, 'to_b', a.position,
                       'reason', nullif(btrim(p_reason), '')));
end;
$$;

-- ── A member leaves, a replacement takes over (rules L1 to L6) ───────────────
-- The new holder takes the slot from p_from_period to the end. The old holder's stretch ends the period
-- before. This also works for a slot that was already paid out (rule L4). How the pot is split is not
-- decided here: record_payout receives the split worked out by the tested TypeScript function.

create function public.replace_holder(
  p_committee_id uuid, p_slot_id uuid, p_new_member_id uuid, p_from_period smallint, p_reason text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.committees;
  cur public.slot_holders;
begin
  c := public.ck_lock(p_committee_id, array['running']);

  if not exists (select 1 from public.slots where id = p_slot_id and committee_id = p_committee_id) then
    raise exception 'That slot is not in this committee';
  end if;
  if not exists (select 1 from public.members where id = p_new_member_id and committee_id = p_committee_id) then
    raise exception 'The replacement is not a member of this committee';
  end if;

  select * into cur from public.slot_holders where slot_id = p_slot_id and to_period is null for update;
  if cur.id is null then raise exception 'That slot has no current holder'; end if;
  if cur.member_id = p_new_member_id then raise exception 'The replacement is already the holder'; end if;
  if p_from_period <= cur.from_period or p_from_period > c.periods then
    raise exception 'The replacement must start after period % and no later than period %', cur.from_period, c.periods;
  end if;

  -- The leaver must not have payments recorded for periods the replacement now owns.
  if exists (select 1 from public.payments_current
              where slot_id = p_slot_id and member_id = cur.member_id and period >= p_from_period) then
    raise exception 'Payments by the current holder are recorded from period % on; correct them first', p_from_period;
  end if;

  update public.slot_holders set to_period = p_from_period - 1 where id = cur.id;
  insert into public.slot_holders (slot_id, member_id, from_period, to_period)
  values (p_slot_id, p_new_member_id, p_from_period, null);

  perform public.ck_log(p_committee_id, 'holder_replaced', public.ck_today(),
    jsonb_build_object('slot_id', p_slot_id, 'leaver_id', cur.member_id, 'replacement_id', p_new_member_id,
                       'from_period', p_from_period, 'reason', nullif(btrim(p_reason), '')));
end;
$$;

-- ── Finish (running -> completed, rules section 6) ───────────────────────────
-- Needs: the last period has passed, and every turn has been paid out. Periods without a recorded payment
-- are allowed only if the organiser says they were settled outside the app (p_settlement_note); that
-- statement is written into the history entry.
-- Assumption [A] to confirm: period 1 falls in the month of the start date, due on the due day.

create function public.complete_committee(p_committee_id uuid, p_settlement_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.committees;
  v_last_due date;
  v_unpaid_turns integer;
  v_missing integer;
  v_problems text[] := '{}';
begin
  c := public.ck_lock(p_committee_id, array['forming', 'running', 'completed']);
  if c.status = 'forming' then raise exception 'A committee cannot be completed before it has started'; end if;
  if c.status = 'completed' then raise exception 'This committee is already completed'; end if;

  v_last_due := (date_trunc('month', c.start_date) + make_interval(months => c.periods - 1)
                 + make_interval(days => c.due_day - 1))::date;
  if public.ck_today() < v_last_due then
    v_problems := v_problems || format('The last period is not over yet (last due day %s)', v_last_due);
  end if;

  select count(*) into v_unpaid_turns from public.slots where committee_id = p_committee_id and not paid_out;
  if v_unpaid_turns > 0 then
    v_problems := v_problems || format('%s turn(s) have not been paid out', v_unpaid_turns);
  end if;

  -- Every slot pays every period, so periods x periods payments are expected in total.
  select c.periods * c.periods - count(*) into v_missing
    from public.payments_current where committee_id = p_committee_id;
  if v_missing > 0 and nullif(btrim(p_settlement_note), '') is null then
    v_problems := v_problems || format('%s payment(s) are not recorded; record them, or say how they were settled', v_missing);
  end if;

  if array_length(v_problems, 1) > 0 then
    raise exception 'Cannot complete yet: %', array_to_string(v_problems, '; ');
  end if;

  update public.committees set status = 'completed' where id = p_committee_id;
  perform public.ck_log(p_committee_id, 'committee_completed', public.ck_today(),
    jsonb_build_object('unrecorded_payments', greatest(v_missing, 0),
                       'settlement_note', nullif(btrim(p_settlement_note), '')));
end;
$$;

-- ── Who may call these ───────────────────────────────────────────────────────

revoke execute on function public.set_order_method(uuid, text, text) from public, anon;
revoke execute on function public.draw_all(uuid, text) from public, anon;
revoke execute on function public.draw_next(uuid, boolean, text) from public, anon;
revoke execute on function public.swap_turns(uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.replace_holder(uuid, uuid, uuid, smallint, text) from public, anon;
revoke execute on function public.complete_committee(uuid, text) from public, anon;

grant execute on function public.set_order_method(uuid, text, text) to authenticated;
grant execute on function public.draw_all(uuid, text) to authenticated;
grant execute on function public.draw_next(uuid, boolean, text) to authenticated;
grant execute on function public.swap_turns(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.replace_holder(uuid, uuid, uuid, smallint, text) to authenticated;
grant execute on function public.complete_committee(uuid, text) to authenticated;
