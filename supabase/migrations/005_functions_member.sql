-- CommitteeKeeper 005: what members can see, and how the organiser manages member links.
-- Run once, in order, in the Supabase SQL Editor (see supabase/README.md). A migration that has been run is never edited.
--
-- The rule for members: they have NO access to any table. They only call the functions below, and each
-- function returns that member's own information and nothing else. The security work is in one place,
-- ck_member_json(), so the link page and the account pages cannot disagree about what is shown.
--
-- What a member always gets: their committee's name and status, the agreement, their own turn(s),
-- the current period, and their own payments (with a count of their receipts).
-- Only if the organiser switched it on (all off by default):
--   members_see_turns     -> the order of turns, with the current holder's name
--   members_see_payments  -> who has paid this period
--   members_see_history   -> history entries about the member themselves (type and date only)
-- Never returned to a member: anyone's email or phone, any link token, other people's payment details,
-- payment notes, or the history of anyone else.

-- ── The one place that builds a member's view ────────────────────────────────

create function public.ck_member_json(p_member_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  m public.members;
  c public.committees;
  v_today date := public.ck_today();
  v_cur integer;
  v_result jsonb;
begin
  select * into m from public.members where id = p_member_id;
  select * into c from public.committees where id = m.committee_id;
  if m.id is null or c.id is null then return '{}'::jsonb; end if;

  -- The period we are in now: 1 in the month of the start date, up to the last period; 0 until it starts.
  v_cur := case when c.status = 'forming' then 0
           else greatest(0, least(c.periods,
                  ((extract(year from v_today) * 12 + extract(month from v_today))
                 - (extract(year from c.start_date) * 12 + extract(month from c.start_date)) + 1)::integer))
           end;

  v_result := jsonb_build_object(
    'committee', jsonb_build_object(
      'name', c.name, 'status', c.status, 'amount', c.amount, 'periods', c.periods,
      'start_date', c.start_date, 'due_day', c.due_day, 'grace_days', c.grace_days,
      'display_style', c.display_style, 'display_grouping', c.display_grouping),
    'me', jsonb_build_object('member_id', m.id, 'name', m.name),
    'current_period', v_cur,
    'periods_left', c.periods - v_cur,

    -- My turns: one per slot I hold or held, with the stretches of periods I was responsible for.
    'my_slots', coalesce((
      select jsonb_agg(jsonb_build_object(
               'slot_id', s.id, 'position', s.position, 'paid_out', s.paid_out,
               'stretches', (select jsonb_agg(jsonb_build_object('from', h.from_period, 'to', h.to_period)
                                              order by h.from_period)
                               from public.slot_holders h
                              where h.slot_id = s.id and h.member_id = m.id))
             order by s.position nulls last)
        from public.slots s
       where s.committee_id = c.id
         and exists (select 1 from public.slot_holders h where h.slot_id = s.id and h.member_id = m.id)
    ), '[]'::jsonb),

    -- My payments: only mine, only the ones that count, no notes.
    'my_payments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'payment_id', p.id, 'slot_id', p.slot_id, 'period', p.period, 'amount', p.amount,
               'paid_on', p.paid_on, 'method', p.method,
               'receipts', (select count(*) from public.receipts r
                             where r.payment_id = p.id and r.removed_at is null))
             order by p.period)
        from public.payments_current p
       where p.member_id = m.id and p.committee_id = c.id
    ), '[]'::jsonb)
  );

  if c.members_see_turns then
    v_result := v_result || jsonb_build_object('all_turns', coalesce((
      select jsonb_agg(jsonb_build_object(
               'position', s.position, 'paid_out', s.paid_out,
               'holder', hm.name, 'is_me', hm.id = m.id)
             order by s.position nulls last)
        from public.slots s
        join public.slot_holders h on h.slot_id = s.id and h.to_period is null
        join public.members hm on hm.id = h.member_id
       where s.committee_id = c.id
    ), '[]'::jsonb));
  end if;

  if c.members_see_payments then
    v_result := v_result || jsonb_build_object('payment_status', coalesce((
      select jsonb_agg(jsonb_build_object(
               'holder', hm.name, 'is_me', hm.id = m.id,
               'paid', exists (select 1 from public.payments_current p
                                where p.slot_id = s.id and p.period = v_cur))
             order by hm.name)
        from public.slots s
        join public.slot_holders h on h.slot_id = s.id
                                  and h.from_period <= v_cur and (h.to_period is null or h.to_period >= v_cur)
        join public.members hm on hm.id = h.member_id
       where s.committee_id = c.id and v_cur > 0
    ), '[]'::jsonb));
  end if;

  if c.members_see_history then
    v_result := v_result || jsonb_build_object('history', coalesce((
      select jsonb_agg(jsonb_build_object('seq', e.seq, 'type', e.type, 'happened_on', e.happened_on)
                       order by e.seq)
        from public.ledger_events e
       where e.committee_id = c.id and e.payload ->> 'member_id' = m.id::text
    ), '[]'::jsonb));
  end if;

  return v_result;
end;
$$;

revoke execute on function public.ck_member_json(uuid) from public, anon, authenticated;

-- ── Member with a link (no account) ──────────────────────────────────────────
-- A wrong token, an unknown token and a switched-off link all give the same empty answer, so nobody can
-- tell whether a token exists.

create function public.member_view(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_member uuid;
begin
  select id into v_member from public.members where link_token = p_token and link_enabled;
  if v_member is null then return '{}'::jsonb; end if;
  return public.ck_member_json(v_member);
end;
$$;

-- Paths of MY receipts for one payment, so the server can make short-lived download links (decision 1).
-- Only receipts of payments that belong to the member behind the token.
create function public.member_receipt_paths(p_token text, p_payment_id uuid) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
  v_member uuid;
begin
  select id into v_member from public.members where link_token = p_token and link_enabled;
  if v_member is null then return '{}'; end if;

  return coalesce((
    select array_agg(r.storage_path order by r.slot_no)
      from public.receipts r
      join public.payments_current p on p.id = r.payment_id
     where r.payment_id = p_payment_id and r.removed_at is null and p.member_id = v_member
  ), '{}');
end;
$$;

-- ── Member with an account (view only) ───────────────────────────────────────

-- Attaches the signed-in account to the member behind a link. Works once per member, only for an
-- enabled link. After this the member sees all their committees together in member_home().
create function public.attach_account(p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid;
begin
  if auth.uid() is null then return false; end if;

  update public.members set user_id = auth.uid()
   where link_token = p_token and link_enabled and user_id is null
  returning id into v_member;

  return v_member is not null;
end;
$$;

-- All the committees I belong to: one view per membership.
create function public.member_home() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(public.ck_member_json(m.id) order by m.created_at)
      from public.members m
     where m.user_id = auth.uid() and m.link_enabled
  ), '[]'::jsonb);
end;
$$;

-- Paths of my receipts for one payment, for a member with an account.
create function public.member_receipt_paths_account(p_member_id uuid, p_payment_id uuid) returns text[]
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null
     or not exists (select 1 from public.members
                     where id = p_member_id and user_id = auth.uid() and link_enabled) then
    return '{}';
  end if;

  return coalesce((
    select array_agg(r.storage_path order by r.slot_no)
      from public.receipts r
      join public.payments_current p on p.id = r.payment_id
     where r.payment_id = p_payment_id and r.removed_at is null and p.member_id = p_member_id
  ), '{}');
end;
$$;

-- ── The organiser manages a member's link ────────────────────────────────────
-- (Link changes are access settings, not committee facts, so they are not written to the history.)

create function public.set_member_link(p_committee_id uuid, p_member_id uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.ck_lock(p_committee_id, array['forming', 'running']);

  update public.members set link_enabled = p_enabled
   where id = p_member_id and committee_id = p_committee_id;
  if not found then raise exception 'That member is not in this committee'; end if;
end;
$$;

-- Replaces the link with a new one; the old link stops working at once. Returns the new token.
create function public.new_member_link(p_committee_id uuid, p_member_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_token text := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
begin
  perform public.ck_lock(p_committee_id, array['forming', 'running']);

  update public.members set link_token = v_token, link_enabled = true
   where id = p_member_id and committee_id = p_committee_id;
  if not found then raise exception 'That member is not in this committee'; end if;
  return v_token;
end;
$$;

-- ── Who may call these ───────────────────────────────────────────────────────
-- member_view and member_receipt_paths are the only things a signed-out visitor can call.

revoke execute on function public.member_view(text) from public;
revoke execute on function public.member_receipt_paths(text, uuid) from public;
revoke execute on function public.attach_account(text) from public, anon;
revoke execute on function public.member_home() from public, anon;
revoke execute on function public.member_receipt_paths_account(uuid, uuid) from public, anon;
revoke execute on function public.set_member_link(uuid, uuid, boolean) from public, anon;
revoke execute on function public.new_member_link(uuid, uuid) from public, anon;

grant execute on function public.member_view(text) to anon, authenticated;
grant execute on function public.member_receipt_paths(text, uuid) to anon, authenticated;
grant execute on function public.attach_account(text) to authenticated;
grant execute on function public.member_home() to authenticated;
grant execute on function public.member_receipt_paths_account(uuid, uuid) to authenticated;
grant execute on function public.set_member_link(uuid, uuid, boolean) to authenticated;
grant execute on function public.new_member_link(uuid, uuid) to authenticated;
