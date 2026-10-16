-- CommitteeKeeper 004a: organiser functions for setting up a committee (part 1 of 3 of migration 004).
-- Run once, in order, in the Supabase SQL Editor (see supabase/README.md). A migration that has been run is never edited.
-- (If you prefer, rename the three parts 004, 005, 006 and shift the later migrations; the content is what matters.)
--
-- Why functions: the tables cannot be written to directly. Each function below checks WHO is asking
-- and WHAT STATE the committee is in, changes the data, and writes the history entry in the SAME step,
-- so the data and the history can never disagree. If anything fails, nothing is saved.
--
-- Functions here:
--   create_committee, update_settings, set_visibility,
--   add_member, remove_member, add_slot, remove_slot, set_order, start_committee
-- Part 2 (004b): payments, receipts, payouts, corrections.  Part 3 (004c): draws, swaps, leave/replace, complete.

-- ── Two private helpers (nobody outside the database calls these) ────────────

-- Finds the committee, locks it so two requests cannot clash, and checks the caller is its organiser
-- and that its status allows the action. "Not allowed" is the same message whether the committee does
-- not exist or belongs to someone else, so nobody can probe for other people's committees.
create function public.ck_lock(p_committee_id uuid, p_allowed_statuses text[])
returns public.committees
language plpgsql security definer set search_path = '' as $$
declare
  c public.committees;
begin
  select * into c from public.committees where id = p_committee_id for update;
  if c.id is null or c.organiser_id is distinct from auth.uid() then
    raise exception 'Not allowed';
  end if;
  if not (c.status = any (p_allowed_statuses)) then
    raise exception 'This committee is % so that action is not allowed', c.status;
  end if;
  return c;
end;
$$;

-- Adds one entry to the history, as the signed-in organiser.
create function public.ck_log(
  p_committee_id uuid, p_type text, p_happened_on date, p_payload jsonb,
  p_corrects uuid default null
) returns void
language sql security definer set search_path = '' as $$
  insert into public.ledger_events (committee_id, type, actor_id, happened_on, payload, corrects_event_id,
                                    seq, recorded_at, prev_hash, hash)
  values (p_committee_id, p_type, auth.uid(), p_happened_on, p_payload, p_corrects,
          0, now(), '', '');  -- the last four are replaced by the trigger in 002
$$;

revoke execute on function public.ck_lock(uuid, text[]) from public, anon, authenticated;
revoke execute on function public.ck_log(uuid, text, date, jsonb, uuid) from public, anon, authenticated;

-- Today's date in Pakistan time (UTC+5, rule B5). Without this, an organiser working after midnight in
-- Pakistan would be told today's date is "in the future".
create function public.ck_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Karachi')::date;
$$;

revoke execute on function public.ck_today() from public, anon, authenticated;

-- ── Create and edit the agreement ────────────────────────────────────────────

create function public.create_committee(
  p_name text, p_amount integer, p_periods smallint, p_start_date date,
  p_due_day smallint, p_grace_days smallint, p_order_method text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not allowed'; end if;

  insert into public.committees (organiser_id, name, amount, periods, start_date, due_day, grace_days, order_method)
  values (auth.uid(), btrim(p_name), p_amount, p_periods, p_start_date, p_due_day, p_grace_days, p_order_method)
  returning id into v_id;   -- the table's checks refuse bad values (empty name, amount 0, periods outside 2 to 30)

  perform public.ck_log(v_id, 'committee_created', public.ck_today(),
    jsonb_build_object('name', btrim(p_name), 'amount', p_amount, 'periods', p_periods,
                       'start_date', p_start_date, 'order_method', p_order_method));
  return v_id;
end;
$$;

-- Change the agreement. Only while forming (once running, amount, periods and start date are fixed).
create function public.update_settings(
  p_committee_id uuid, p_name text, p_amount integer, p_periods smallint, p_start_date date,
  p_due_day smallint, p_grace_days smallint, p_order_method text,
  p_remind_before_days smallint, p_remind_late_every smallint,
  p_display_style text, p_display_grouping text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.ck_lock(p_committee_id, array['forming']);

  update public.committees set
    name = btrim(p_name), amount = p_amount, periods = p_periods, start_date = p_start_date,
    due_day = p_due_day, grace_days = p_grace_days, order_method = p_order_method,
    remind_before_days = p_remind_before_days, remind_late_every = p_remind_late_every,
    display_style = p_display_style, display_grouping = p_display_grouping
  where id = p_committee_id;

  perform public.ck_log(p_committee_id, 'settings_set', public.ck_today(),
    jsonb_build_object('name', btrim(p_name), 'amount', p_amount, 'periods', p_periods,
                       'start_date', p_start_date, 'due_day', p_due_day, 'grace_days', p_grace_days,
                       'order_method', p_order_method));
end;
$$;

-- What members may see. Allowed while forming or running (not once completed).
create function public.set_visibility(
  p_committee_id uuid, p_payments boolean, p_turns boolean, p_history boolean
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.ck_lock(p_committee_id, array['forming', 'running']);

  update public.committees
     set members_see_payments = p_payments, members_see_turns = p_turns, members_see_history = p_history
   where id = p_committee_id;

  perform public.ck_log(p_committee_id, 'settings_set', public.ck_today(),
    jsonb_build_object('members_see_payments', p_payments, 'members_see_turns', p_turns,
                       'members_see_history', p_history));
end;
$$;

-- ── Members and slots ────────────────────────────────────────────────────────

create function public.add_member(
  p_committee_id uuid, p_name text, p_email text default null, p_phone text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform public.ck_lock(p_committee_id, array['forming', 'running']);

  insert into public.members (committee_id, name, email, phone)
  values (p_committee_id, btrim(p_name), nullif(btrim(p_email), ''), nullif(btrim(p_phone), ''))
  returning id into v_id;

  -- The history holds the name only, never the email or phone (the history can be shown to members).
  perform public.ck_log(p_committee_id, 'member_invited', public.ck_today(),
    jsonb_build_object('member_id', v_id, 'name', btrim(p_name)));
  return v_id;
end;
$$;

-- Fixes a typo or changes contact details. The history records the new name only (never email or phone).
create function public.update_member(
  p_committee_id uuid, p_member_id uuid, p_name text, p_email text default null, p_phone text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.ck_lock(p_committee_id, array['forming', 'running']);

  update public.members
     set name = btrim(p_name), email = nullif(btrim(p_email), ''), phone = nullif(btrim(p_phone), '')
   where id = p_member_id and committee_id = p_committee_id;
  if not found then raise exception 'That member is not in this committee'; end if;

  perform public.ck_log(p_committee_id, 'member_updated', public.ck_today(),
    jsonb_build_object('member_id', p_member_id, 'name', btrim(p_name)));
end;
$$;

-- Section 9: the organiser records that a member has agreed to the written agreement. Members do not
-- have to use the app to agree; this is the organiser noting it.
create function public.record_agreement(p_committee_id uuid, p_member_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.ck_lock(p_committee_id, array['forming', 'running']);

  if not exists (select 1 from public.members where id = p_member_id and committee_id = p_committee_id) then
    raise exception 'That member is not in this committee';
  end if;

  perform public.ck_log(p_committee_id, 'agreement_accepted', public.ck_today(),
    jsonb_build_object('member_id', p_member_id, 'note', nullif(btrim(p_note), '')));
end;
$$;

-- Rule L7: before the committee starts a member can simply be removed (if they hold no slot).
create function public.remove_member(p_committee_id uuid, p_member_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  perform public.ck_lock(p_committee_id, array['forming']);

  select name into v_name from public.members where id = p_member_id and committee_id = p_committee_id;
  if v_name is null then raise exception 'That member is not in this committee'; end if;
  if exists (select 1 from public.slot_holders where member_id = p_member_id) then
    raise exception 'Remove this member''s slots first';
  end if;

  delete from public.members where id = p_member_id;
  perform public.ck_log(p_committee_id, 'member_removed', public.ck_today(),
    jsonb_build_object('member_id', p_member_id, 'name', v_name));
end;
$$;

-- Adds one slot (one turn) held by the member from period 1 to the end. A member can hold several slots.
create function public.add_slot(p_committee_id uuid, p_member_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_slot uuid;
begin
  perform public.ck_lock(p_committee_id, array['forming']);

  if not exists (select 1 from public.members where id = p_member_id and committee_id = p_committee_id) then
    raise exception 'That member is not in this committee';
  end if;
  if (select count(*) from public.slots where committee_id = p_committee_id)
       >= (select periods from public.committees where id = p_committee_id) then
    raise exception 'This committee already has as many slots as periods';
  end if;

  insert into public.slots (committee_id) values (p_committee_id) returning id into v_slot;
  insert into public.slot_holders (slot_id, member_id, from_period, to_period)
  values (v_slot, p_member_id, 1, null);

  perform public.ck_log(p_committee_id, 'slot_added', public.ck_today(),
    jsonb_build_object('slot_id', v_slot, 'member_id', p_member_id));
  return v_slot;
end;
$$;

create function public.remove_slot(p_committee_id uuid, p_slot_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.ck_lock(p_committee_id, array['forming']);

  if not exists (select 1 from public.slots where id = p_slot_id and committee_id = p_committee_id) then
    raise exception 'That slot is not in this committee';
  end if;

  delete from public.slot_holders where slot_id = p_slot_id;
  delete from public.slots where id = p_slot_id;
  perform public.ck_log(p_committee_id, 'slot_removed', public.ck_today(), jsonb_build_object('slot_id', p_slot_id));
end;
$$;

-- ── Turn order by hand ───────────────────────────────────────────────────────

-- p_slot_ids is the new order, first turn first. It must list every slot whose turn is NOT yet paid out,
-- exactly once. Turns already paid out stay where they are (rule O4). Allowed while forming or running.
create function public.set_order(p_committee_id uuid, p_slot_ids uuid[], p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_paid_count integer;
  v_unpaid_count integer;
  v_i integer;
begin
  perform public.ck_lock(p_committee_id, array['forming', 'running']);

  select count(*) into v_paid_count from public.slots where committee_id = p_committee_id and paid_out;
  select count(*) into v_unpaid_count from public.slots where committee_id = p_committee_id and not paid_out;

  if coalesce(array_length(p_slot_ids, 1), 0) <> v_unpaid_count
     or (select count(distinct s) from unnest(p_slot_ids) s) <> v_unpaid_count
     or exists (
       select 1 from unnest(p_slot_ids) s
        where not exists (select 1 from public.slots
                           where id = s and committee_id = p_committee_id and not paid_out)
     ) then
    raise exception 'The order must list every turn that is not yet paid out, each exactly once';
  end if;

  -- Clear first, then set, so two slots never share a position while we work.
  update public.slots set position = null where committee_id = p_committee_id and not paid_out;
  for v_i in 1 .. v_unpaid_count loop
    update public.slots set position = v_paid_count + v_i where id = p_slot_ids[v_i];
  end loop;

  perform public.ck_log(p_committee_id, 'order_set', public.ck_today(),
    jsonb_build_object('order', to_jsonb(p_slot_ids), 'reason', nullif(btrim(p_reason), '')));
end;
$$;

-- ── Start ────────────────────────────────────────────────────────────────────

-- forming -> running (rules section 6). Collects EVERY problem and reports them together.
-- A start date in the past is fine: that is how an already-running committee is entered (rule B1).
create function public.start_committee(p_committee_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.committees;
  v_slots integer;
  v_unheld integer;
  v_unordered integer;
  v_problems text[] := '{}';
begin
  c := public.ck_lock(p_committee_id, array['forming']);

  select count(*) into v_slots from public.slots where committee_id = p_committee_id;
  select count(*) into v_unheld from public.slots s
   where s.committee_id = p_committee_id
     and not exists (select 1 from public.slot_holders h where h.slot_id = s.id);
  select count(*) into v_unordered from public.slots where committee_id = p_committee_id and position is null;

  if v_slots < 2 then v_problems := v_problems || 'Add at least 2 slots'; end if;
  if v_slots <> c.periods then
    v_problems := v_problems || format('The number of slots (%s) must equal the number of periods (%s)', v_slots, c.periods);
  end if;
  if v_unheld > 0 then v_problems := v_problems || 'Every slot needs a holder'; end if;
  if c.order_method <> 'draw_monthly' and v_unordered > 0 then
    v_problems := v_problems || 'Set the turn order first (by hand or by the start draw)';
  end if;

  if array_length(v_problems, 1) > 0 then
    raise exception 'Cannot start yet: %', array_to_string(v_problems, '; ');
  end if;

  update public.committees set status = 'running' where id = p_committee_id;
  perform public.ck_log(p_committee_id, 'committee_started', public.ck_today(),
    jsonb_build_object('start_date', c.start_date, 'slots', v_slots));
end;
$$;

-- ── Who may call these ───────────────────────────────────────────────────────
-- Only signed-in users. Each function still checks that the caller is the committee's organiser.

revoke execute on function public.create_committee(text, integer, smallint, date, smallint, smallint, text) from public, anon;
revoke execute on function public.update_settings(uuid, text, integer, smallint, date, smallint, smallint, text, smallint, smallint, text, text) from public, anon;
revoke execute on function public.set_visibility(uuid, boolean, boolean, boolean) from public, anon;
revoke execute on function public.add_member(uuid, text, text, text) from public, anon;
revoke execute on function public.update_member(uuid, uuid, text, text, text) from public, anon;
revoke execute on function public.record_agreement(uuid, uuid, text) from public, anon;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
revoke execute on function public.add_slot(uuid, uuid) from public, anon;
revoke execute on function public.remove_slot(uuid, uuid) from public, anon;
revoke execute on function public.set_order(uuid, uuid[], text) from public, anon;
revoke execute on function public.start_committee(uuid) from public, anon;

grant execute on function public.create_committee(text, integer, smallint, date, smallint, smallint, text) to authenticated;
grant execute on function public.update_settings(uuid, text, integer, smallint, date, smallint, smallint, text, smallint, smallint, text, text) to authenticated;
grant execute on function public.set_visibility(uuid, boolean, boolean, boolean) to authenticated;
grant execute on function public.add_member(uuid, text, text, text) to authenticated;
grant execute on function public.update_member(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.record_agreement(uuid, uuid, text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.add_slot(uuid, uuid) to authenticated;
grant execute on function public.remove_slot(uuid, uuid) to authenticated;
grant execute on function public.set_order(uuid, uuid[], text) to authenticated;
grant execute on function public.start_committee(uuid) to authenticated;
