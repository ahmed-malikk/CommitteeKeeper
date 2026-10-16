-- CommitteeKeeper 008_fix_start_problems: start_committee failed with "malformed array literal" when it
-- had to list a problem written as plain text (found by scripts/check-security.mjs on its first run).
-- Cause: `text[] || 'some text'` makes Postgres read the text as an array. Fix: build the list with
-- array_append(..., '...'::text), which is explicit about the type. Same rules, same messages.
-- 004a is not edited (it has been run); create or replace keeps the function's existing access rights.

create or replace function public.start_committee(p_committee_id uuid) returns void
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

  if v_slots < 2 then v_problems := array_append(v_problems, 'Add at least 2 slots'::text); end if;
  if v_slots <> c.periods then
    v_problems := array_append(v_problems,
      format('The number of slots (%s) must equal the number of periods (%s)', v_slots, c.periods));
  end if;
  if v_unheld > 0 then v_problems := array_append(v_problems, 'Every slot needs a holder'::text); end if;
  if c.order_method <> 'draw_monthly' and v_unordered > 0 then
    v_problems := array_append(v_problems, 'Set the turn order first (by hand or by the start draw)'::text);
  end if;

  if array_length(v_problems, 1) > 0 then
    raise exception 'Cannot start yet: %', array_to_string(v_problems, '; ');
  end if;

  update public.committees set status = 'running' where id = p_committee_id;
  perform public.ck_log(p_committee_id, 'committee_started', public.ck_today(),
    jsonb_build_object('start_date', c.start_date, 'slots', v_slots));
end;
$$;
