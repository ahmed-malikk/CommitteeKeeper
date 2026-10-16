-- CommitteeKeeper 007_hardening: closes gaps the by-hand check found after migrations 001 to 006.
-- Run once in Supabase -> SQL Editor. Does not touch any data.
--
-- What the check found (17 Oct):
--   1. Signed-in and signed-out users still held TRUNCATE (and probably REFERENCES/TRIGGER) on tables.
--      Row-level security does not apply to TRUNCATE, so this had to go.
--   2. Signed-out visitors held some rights on every table, though they should have none.
--   3. The sign-up helper handle_new_user() could be run by signed-out visitors (it is meant only for the trigger).
--
-- The fix: take every table right away from the API roles, then give back exactly one: signed-in users may
-- READ (row-level security then limits them to their own committees). Everything else goes through functions.

revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;

-- The sign-up helper is only used by the trigger on new users. A trigger does not need the right to be
-- executed by users at firing time, so sign-up keeps working.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- From now on, new tables and functions made by this account start with NO rights for the API roles,
-- so a future migration cannot open something by forgetting a revoke. Each migration grants what it needs.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;
