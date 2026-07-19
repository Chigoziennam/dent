-- ============================================================
-- SUPER DENT X — UPGRADE 7: server-side AI budget.
-- Run in: Supabase → SQL Editor → paste → Run. Safe to re-run.
--
-- WHY THIS TABLE EXISTS
-- Limits enforced in the browser are advisory, not real. localStorage can be
-- edited, and anyone can skip the app entirely and POST straight to the n8n
-- webhook with curl. If the only ceiling lives in plan.ts, the ceiling is
-- decorative and the bill is ours.
--
-- Every AI call gets one row here, written by n8n AFTER the model responds.
-- Before each call n8n counts the rows in the window and refuses if the user
-- is over. That makes the budget a property of the system, not of the client.
--
-- Run order (all idempotent):
--   1. schema.sql
--   2. upgrade-payments-accounts.sql
--   3. upgrade-3-dedupe-sync.sql
--   4. upgrade-4-progress-sync.sql
--   5. upgrade-5-proofs-storage.sql
--   6. upgrade-6-writer.sql
--   7. upgrade-7-ai-usage.sql   (this file)
-- ============================================================

create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  -- 'generate' | 'fuse' | 'humanize' share the writer budget; 'chat' has its own.
  task text not null,
  model text,
  -- Rough token counts for cost attribution. Not billing-grade, just enough
  -- to see which tier and which task is actually spending the money.
  tokens_in int,
  tokens_out int,
  created_at timestamptz not null default now()
);

-- The only query n8n runs against this: "rows for this user, this budget,
-- since this timestamp". Partial-free index keeps the count cheap as it grows.
create index if not exists idx_ai_usage_window
  on ai_usage(user_id, task, created_at desc);

alter table ai_usage enable row level security;

-- Users may read their own usage (the app shows "12 of 60 left today").
drop policy if exists "own usage" on ai_usage;
create policy "own usage" on ai_usage
  for select using (auth.uid() = user_id);

-- No client INSERT policy on purpose. Only n8n writes here, via the
-- service_role key, which bypasses RLS. If the browser could write its own
-- usage rows it could also decline to, and the budget would mean nothing.

-- ------------------------------------------------------------
-- Convenience view: current-window consumption per user.
-- 'chat' resets daily, writer tasks roll over 30 days.
-- ------------------------------------------------------------
create or replace view v_ai_usage_now as
select
  user_id,
  count(*) filter (where task = 'chat'  and created_at >= now() - interval '1 day')  as chat_today,
  count(*) filter (where task <> 'chat' and created_at >= now() - interval '7 days')  as writes_week,
  count(*) filter (where task <> 'chat' and created_at >= now() - interval '30 days') as writes_month,
  max(created_at) as last_call
from ai_usage
group by user_id;
