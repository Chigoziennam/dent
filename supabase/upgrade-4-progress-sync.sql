-- ============================================================
-- SUPER DENT X — UPGRADE 4: progress follows the account.
-- Run in: Supabase → SQL Editor → paste → Run. Safe to re-run.
--
-- WHY: builder score, streak, unlocked achievements and the weekly
-- AI-credit count used to live only in the browser's localStorage.
-- Sign in on a new phone or clear your cache and it all reset — the
-- "Hello World" badge re-fired on your first log, AI credits went
-- back to 7, your level dropped. These columns store that progress
-- on your profile so every browser shows the same you.
-- (builder_score / streak_current / streak_longest / total_ships
--  already exist from schema.sql — only the four below are new.)
-- ============================================================

alter table profiles add column if not exists unlocked jsonb not null default '{}'::jsonb;
alter table profiles add column if not exists ai_week text;
alter table profiles add column if not exists ai_week_count int not null default 0;
alter table profiles add column if not exists ai_used int not null default 0;

-- ============================================================
-- Run order for a fresh project:
--   1. schema.sql
--   2. upgrade-payments-accounts.sql   (email, start_stage, avatar…)
--   3. upgrade-3-dedupe-sync.sql       (ship dedup + unique index)
--   4. upgrade-4-progress-sync.sql     (this file)
-- All are idempotent — re-running never hurts.
-- ============================================================
