-- CommitteeKeeper: all the by-hand database checks in ONE result table (read-only, safe to run any time).
-- "found" lists the problems; the check passes when it is empty (or equals "expected" where noted).
select 'Tables without row-level security' as check_name,
       coalesce(string_agg(c.relname, ', '), '') as found,
       '' as expected
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
union all
select 'Direct write rights for signed-in/signed-out users',
       coalesce(string_agg(distinct table_name || ' (' || grantee || ' ' || privilege_type || ')', ', '), ''),
       ''
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon', 'authenticated', 'public')
   and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
union all
select 'Tables a signed-out visitor can touch',
       coalesce(string_agg(distinct table_name, ', '), ''),
       ''
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee = 'anon'
union all
select 'Functions a signed-out visitor can run',
       coalesce(string_agg(p.proname, ', ' order by p.proname), ''),
       'member_receipt_paths, member_view (rls_auto_enable is Supabase''s own helper and is fine)'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')
union all
select 'Owner-rights functions without a fixed search path',
       coalesce(string_agg(p.proname, ', '), ''),
       ''
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef
   and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')
union all
select 'Receipts bucket (public / size limit / types)',
       coalesce((select public::text || ' / ' || file_size_limit::text || ' / ' || array_to_string(allowed_mime_types, ',')
                   from storage.buckets where id = 'receipts'), 'MISSING'),
       'false / 2097152 / image/jpeg,image/png,image/webp'
union all
select 'Receipt storage policies',
       coalesce(string_agg(policyname || ' [' || cmd || ']', '; ' order by cmd), 'NONE'),
       '3 policies: DELETE, INSERT, SELECT'
  from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like '%receipts%';
