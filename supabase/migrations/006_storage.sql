-- CommitteeKeeper 006: the private bucket for receipt images and who may touch it.
-- Run once, in order, in the Supabase SQL Editor (see supabase/README.md). A migration that has been run is never edited.
--
-- How receipts travel:
--   1. The organiser's phone shrinks the image, then uploads it to this bucket at
--      {committee_id}/{payment_id}/{1 or 2}.webp   (allowed by the organiser policies below).
--   2. The app then calls attach_receipt() (004b) to register the file in the database.
--   3. Members never touch the bucket. When a member opens a receipt, a server route first calls
--      member_receipt_paths() (005) to check it is theirs, then makes a short-lived download link using
--      the server-only key you add to Vercel yourself (decision 1). Nothing else uses that key.
--
-- Known gap, written down on purpose: if step 2 fails after step 1, an image file can sit in the bucket
-- without a database row. A small cleanup job for such orphans comes with the reminder job later.

-- ── The bucket ───────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
-- private (public = false); 2 MB (decision 4); images only. The storage service itself refuses anything else.

-- ── Reading the committee out of a file path ─────────────────────────────────
-- A path looks like  <committee id>/<payment id>/<1 or 2>.webp . Returns the committee id, or null if the
-- path does not have that shape (a null never matches an organiser, so odd paths are simply refused).

create function public.ck_path_committee(p_name text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  if array_length(storage.foldername(p_name), 1) is distinct from 2 then
    return null;
  end if;
  return (storage.foldername(p_name))[1]::uuid;
exception when others then
  return null;
end;
$$;

revoke execute on function public.ck_path_committee(text) from public, anon;
grant execute on function public.ck_path_committee(text) to authenticated;

-- ── Who may do what in the bucket ────────────────────────────────────────────
-- Signed-out visitors and members: nothing (no policy exists for them, so storage refuses).
-- An organiser: upload, read and remove files inside THEIR OWN committees' folders only.
-- Nobody: replace a file in place (no update policy), so a stored image can never be swapped quietly.

create policy "Organisers can upload receipts to their committees"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and public.is_organiser(public.ck_path_committee(name))
  );

create policy "Organisers can read receipts of their committees"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and public.is_organiser(public.ck_path_committee(name))
  );

create policy "Organisers can remove receipts of their committees"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and public.is_organiser(public.ck_path_committee(name))
  );
