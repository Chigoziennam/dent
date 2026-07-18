-- ============================================================
-- SUPER DENT X — UPGRADE 5: screenshot proofs in Storage.
-- Run in: Supabase → SQL Editor → paste → Run. Safe to re-run.
--
-- WHY: a builder can drop a screenshot on a log (a demo, a payout, a
-- green deploy). The image goes to Storage; the log keeps only the
-- URL — so a proof costs a few bytes in the row, not megabytes.
-- ============================================================

-- The bucket. Public read so the URL works anywhere the log is shown.
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', true)
on conflict (id) do nothing;

-- Anyone can VIEW a proof (the URL is public by design).
drop policy if exists "proofs public read" on storage.objects;
create policy "proofs public read" on storage.objects
  for select using (bucket_id = 'proofs');

-- Only the signed-in owner can UPLOAD, and only into their own folder
-- (path starts with their user id: `<uid>/<file>`).
drop policy if exists "proofs owner upload" on storage.objects;
create policy "proofs owner upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

-- Owners may replace/remove their own proofs.
drop policy if exists "proofs owner modify" on storage.objects;
create policy "proofs owner modify" on storage.objects
  for update to authenticated
  using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "proofs owner delete" on storage.objects;
create policy "proofs owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
