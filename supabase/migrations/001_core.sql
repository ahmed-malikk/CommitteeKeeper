-- CommitteeKeeper 001_core: people, committees, members, slots and who holds each slot.
-- Run once, in order, in the Supabase SQL Editor (see supabase/README.md). A migration that has been run is never edited.
-- Never edit this file after it has been run; changes go in a new numbered file.
--
-- What is here:
--   profiles      one row per signed-in person (created automatically at sign-up)
--   committees    one kameti and its agreement (amount, periods, dates, rules, what members may see)
--   members       one person inside one committee (name, optional email/phone, private link)
--   slots         one turn in the cycle (a committee with N slots has N periods)
--   slot_holders  who owns a slot, and for which periods (this is how leaver/replacement works)
--
-- Security in one paragraph:
--   Row-level security (RLS) is ON for every table. The organiser can READ rows of their own
--   committees. Nobody can INSERT, UPDATE or DELETE directly: all changes will go through database
--   functions (migration 004) that also write the history entry. Members and signed-out visitors
--   have no table access at all; they will only call functions (migration 005).

-- ── People ───────────────────────────────────────────────────────────────────

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 80),
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Every new sign-up gets a profile automatically.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

grant select on public.profiles to authenticated;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

-- ── Committees ───────────────────────────────────────────────────────────────

create table public.committees (
  id            uuid primary key default gen_random_uuid(),
  organiser_id  uuid not null references public.profiles (id),
  name          text not null check (char_length(btrim(name)) between 1 and 80),
  amount        integer not null check (amount > 0),                       -- whole rupees per slot per period
  periods       smallint not null check (periods between 2 and 30),        -- decision 5: 2 to 30
  start_date    date not null,                                             -- may be in the past (already-running committees)
  due_day       smallint not null check (due_day between 1 and 28),        -- day of month payments are due
  grace_days    smallint not null default 0 check (grace_days between 0 and 28),
  order_method  text not null check (order_method in ('hand', 'draw_start', 'draw_monthly')),
  status        text not null default 'forming' check (status in ('forming', 'running', 'completed')),

  -- Reminder settings (rules section 10): days before the due day, and days between late reminders.
  remind_before_days   smallint not null default 2 check (remind_before_days between 0 and 14),
  remind_late_every    smallint not null default 3 check (remind_late_every between 1 and 14),

  -- How amounts are shown (rules section 9). Only the display changes; amounts are stored as whole rupees.
  display_style    text not null default 'rs' check (display_style in ('rs', 'rs_dash')),   -- "Rs 12,000" or "Rs. 12,000/-"
  display_grouping text not null default 'western' check (display_grouping in ('western', 'lakh')),

  -- What members may see (rules section 8a). All off by default.
  members_see_payments boolean not null default false,
  members_see_turns    boolean not null default false,
  members_see_history  boolean not null default false,

  created_at    timestamptz not null default now()
);

create index committees_organiser_idx on public.committees (organiser_id);

alter table public.committees enable row level security;

grant select on public.committees to authenticated;

create policy "Organisers can read their own committees"
  on public.committees for select to authenticated
  using (organiser_id = auth.uid());

-- Helper used by the policies below: is the signed-in user the organiser of this committee?
-- It is a function (not a sub-select in each policy) so the checks stay in one place.
create function public.is_organiser(p_committee_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.committees c
    where c.id = p_committee_id and c.organiser_id = auth.uid()
  );
$$;

revoke execute on function public.is_organiser(uuid) from public, anon;
grant execute on function public.is_organiser(uuid) to authenticated;

-- ── Members ──────────────────────────────────────────────────────────────────

create table public.members (
  id            uuid primary key default gen_random_uuid(),
  committee_id  uuid not null references public.committees (id),
  name          text not null check (char_length(btrim(name)) between 1 and 60),
  email         text check (email is null or char_length(email) <= 254),   -- organiser's eyes only
  phone         text check (phone is null or char_length(phone) <= 30),    -- organiser's eyes only
  user_id       uuid references public.profiles (id),                      -- null until the member attaches an account
  link_token    text not null unique default translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_'), -- 32 random bytes, URL-safe (decision 2: stored as-is)
  link_enabled  boolean not null default true,
  created_at    timestamptz not null default now()
);

create index members_committee_idx on public.members (committee_id);
create index members_user_idx on public.members (user_id) where user_id is not null;

alter table public.members enable row level security;

grant select on public.members to authenticated;

create policy "Organisers can read members of their committees"
  on public.members for select to authenticated
  using (public.is_organiser(committee_id));

-- ── Slots and holders ────────────────────────────────────────────────────────

create table public.slots (
  id            uuid primary key default gen_random_uuid(),
  committee_id  uuid not null references public.committees (id),
  position      smallint check (position is null or position >= 1),       -- turn order; null until it is set
  paid_out      boolean not null default false,                             -- true once the pot was handed over; then locked
  created_at    timestamptz not null default now(),
  unique (committee_id, position)                                           -- no two slots share a turn
);

create index slots_committee_idx on public.slots (committee_id);

alter table public.slots enable row level security;

grant select on public.slots to authenticated;

create policy "Organisers can read slots of their committees"
  on public.slots for select to authenticated
  using (public.is_organiser(committee_id));

-- One row per stretch of periods that one member is responsible for a slot.
-- Example from R1: Ali holds periods 1-3 of a slot, Sara holds 4-12 of the same slot.
create table public.slot_holders (
  id           uuid primary key default gen_random_uuid(),
  slot_id      uuid not null references public.slots (id),
  member_id    uuid not null references public.members (id),
  from_period  smallint not null check (from_period >= 1),
  to_period    smallint check (to_period is null or to_period >= from_period),  -- null = until the end
  created_at   timestamptz not null default now()
);

create index slot_holders_slot_idx on public.slot_holders (slot_id);
create index slot_holders_member_idx on public.slot_holders (member_id);

alter table public.slot_holders enable row level security;

grant select on public.slot_holders to authenticated;

create policy "Organisers can read holders of their slots"
  on public.slot_holders for select to authenticated
  using (
    exists (
      select 1 from public.slots s
      where s.id = slot_id and public.is_organiser(s.committee_id)
    )
  );

-- Not enforced here (the write function in 004 checks it): the periods of one slot's holders must not
-- overlap, must start at 1 and must run without gaps to the last period.
