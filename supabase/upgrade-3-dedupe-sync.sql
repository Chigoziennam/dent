-- ============================================================
-- SUPER DENT X — UPGRADE 3: remove duplicate ships + make
-- duplicates impossible forever.
-- Run in: Supabase → SQL Editor → paste → Run. Safe to re-run.
--
-- WHY: the app used to run its login sync twice in parallel, and
-- both copies pushed the same ships. This deletes the copies
-- (keeping the oldest of each) and adds a unique index so the
-- database itself rejects any future duplicate.
-- ============================================================

-- 1. Delete duplicates: same user, same time, same title — keep the
--    earliest row (ties broken by id so exactly one always survives).
delete from ship_events a
using ship_events b
where a.user_id = b.user_id
  and a.event_time = b.event_time
  and a.title = b.title
  and (a.created_at, a.id) > (b.created_at, b.id);

-- 2. The lock: one ship per (user, moment, title). The app now upserts
--    against this index, so retries and double-syncs are harmless.
create unique index if not exists uniq_ship_events_user_time_title
  on ship_events(user_id, event_time, title);

-- ============================================================
-- REMINDER (dashboard toggle, not SQL): Authentication → Sign In /
-- Providers → Email → turn OFF "Confirm email". While it is ON,
-- every new email signup is blocked with "Email not confirmed" and
-- their data never reaches these tables.
-- ============================================================
