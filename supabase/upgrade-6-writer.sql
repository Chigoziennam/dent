-- ============================================================
-- SUPER DENT X — UPGRADE 6: the AI writer's outbox.
-- Run in: Supabase → SQL Editor → paste → Run. Safe to re-run.
--
-- WHY: content_pieces could hold a post, but not say WHO wrote it
-- or WHICH ships it came from. The writer (n8n) drafts posts, the
-- user edits them, and sometimes it's both — that's the "fusion"
-- state. And when the co-pilot explains why it wrote something,
-- source_event_ids is the trail back to the actual ships.
--
-- Run order (all idempotent):
--   1. schema.sql
--   2. upgrade-payments-accounts.sql
--   3. upgrade-3-dedupe-sync.sql
--   4. upgrade-4-progress-sync.sql
--   5. upgrade-5-proofs-storage.sql
--   6. upgrade-6-writer.sql   (this file)
-- ============================================================

-- Who wrote it: 'ai' = n8n drafted it, 'user' = typed by hand,
-- 'fusion' = AI drafted then the user edited it.
alter table content_pieces add column if not exists author text
  not null default 'ai';
do $$ begin
  alter table content_pieces add constraint content_author_check
    check (author in ('ai','user','fusion'));
exception when duplicate_object then null; end $$;

-- Stamped when the user approves the draft for posting.
-- NULL = still waiting on them.
alter table content_pieces add column if not exists approved_at timestamptz;

-- Which ships produced this post (ship_events.id values).
alter table content_pieces add column if not exists source_event_ids uuid[];

-- Which daily log it drew on, if any.
alter table content_pieces add column if not exists source_log_date date;

-- The writer's own note on its angle — shown in the app so the
-- user knows why this post exists before they approve it.
alter table content_pieces add column if not exists rationale text;

-- The app's inbox query is "my drafts, newest first".
create index if not exists idx_content_user_pending
  on content_pieces(user_id, created_at desc)
  where status = 'draft';

-- The day this draft is FOR. Its own column, not created_at::date,
-- because casting timestamptz to date isn't immutable (it depends on
-- the session TimeZone) and Postgres won't index it.
alter table content_pieces add column if not exists draft_date date default current_date;

-- One AI draft per user, per platform, per day — so a re-run of the
-- n8n workflow updates its draft instead of stacking duplicates.
-- (Mirrors the ship dedup approach in upgrade-3.)
create unique index if not exists idx_content_ai_daily
  on content_pieces(user_id, platform, draft_date)
  where author = 'ai' and status = 'draft';
