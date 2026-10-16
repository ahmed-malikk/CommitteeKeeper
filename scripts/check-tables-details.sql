-- CommitteeKeeper: checks you run BY HAND in the Supabase SQL Editor after the migrations.
-- Read-only except the tamper test at the bottom, which you only run on a development database.
-- These cover things the Node script cannot reach (it signs in as ordinary users and has no admin power).

-- ── Check 1 (TC-110): every table has row-level security ON. Expected: zero rows. ──
select c.relname as table_without_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- ── Check 2: nobody except the database owner can write to any table directly. Expected: zero rows. ──
-- (Writes go through the functions. The only grants left should be SELECT.)
select grantee, table_name, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and grantee in ('anon', 'authenticated', 'public')
   and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

-- ── Check 3: signed-out visitors (anon) can read no table. Expected: zero rows. ──
select table_name, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee = 'anon';

-- ── Check 4: which functions can a signed-out visitor run? Expected: exactly member_view and member_receipt_paths. ──
select p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and has_function_privilege('anon', p.oid, 'EXECUTE')
 order by p.proname;

-- ── Check 5: every function that runs with the owner's rights fixes its search path. Expected: zero rows. ──
select p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef
   and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%');

-- ── Check 6: the receipts bucket is private, limited to 2 MB, and images only. Expected: public false, 2097152, three types. ──
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'receipts';

-- ── Check 7: the storage policies. Expected: exactly three, all for 'authenticated', none for anon. ──
select policyname, cmd, roles from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like '%receipts%';

-- ── Tamper test for verify_chain (TC-041). DEVELOPMENT DATABASE ONLY. ──
-- The history refuses changes, so to simulate someone with admin power we switch the guard off for a moment,
-- alter one entry, then ask verify_chain. It must report the broken entry. Replace the id below with a committee
-- id from `select id from committees where name = 'Security check'`. Run all of it in one go:
--
--   begin;
--   alter table public.ledger_events disable trigger ledger_no_update_delete;
--   update public.ledger_events set payload = '{"tampered": true}'::jsonb
--    where committee_id = '<committee id>' and seq = 3;
--   -- verify_chain needs a signed-in organiser, so check the chain with the same formula directly:
--   select seq, hash = public.ledger_hash(prev_hash, seq, type, actor_id, happened_on, recorded_at, payload) as hash_ok
--     from public.ledger_events where committee_id = '<committee id>' order by seq;
--   rollback;   -- undoes the change and the trigger switch, nothing is kept
--
-- Expected: entry 3 shows hash_ok = false, all others true. The rollback leaves the data untouched.
