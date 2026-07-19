-- ============================================================
-- RESET A TEST ACCOUNT — fresh Free tier, credits back to full.
-- Run in: Supabase → SQL Editor. Change the uuid, then Run.
--
-- Use this to test the free-tier limits from a clean slate without
-- creating a new signup each time. It touches ONLY plan and usage —
-- ships, journals, drafts and changelog are left alone.
-- ============================================================

-- The account to reset. 8a538144… is the seeded test builder.
\set uid '8a538144-f652-4aeb-91a7-27a588c9578d'

-- 1. Back to Free, no plan dates hanging around.
update profiles
   set tier            = 'free',
       plan_expires_at = null,
       plan_started_at = null,
       plan_cycle      = null,
       -- Writer credits live on the profile as well as in ai_usage; both
       -- have to go or the app restores the old count on next login.
       ai_week         = null,
       ai_week_count   = 0,
       ai_used         = 0
 where id = :'uid';

-- 2. Clear the server-side usage rows the n8n budget counts against.
delete from ai_usage where user_id = :'uid';

-- 3. Clear AI drafts so the writer's daily unique index doesn't block a
--    re-run on the same platform today.
delete from content_pieces
 where user_id = :'uid' and author = 'ai' and status = 'draft';

-- 4. Confirm.
select builder, plan, status, copilot_used_today, posts_used_this_week
  from v_credits_readable c
  join v_plans_readable p on p.builder = c.builder
 where c.builder = (select display_name from profiles where id = :'uid');
