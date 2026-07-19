-- ============================================================
-- SUPER DENT X — UPGRADE 8: plans that actually expire.
-- Run in: Supabase → SQL Editor → paste → Run. Safe to re-run.
--
-- WHY
-- Checkout set profiles.tier = 'pro' and nothing ever unset it. One month's
-- payment bought Pro forever. Every paying user was, in effect, a one-time
-- customer — and anyone who noticed could pay ₦5,000 once and keep unlimited
-- access for life. This adds the expiry date the tier always implied.
--
-- HOW IT READS
-- plan_expires_at is the single source of truth. tier says what they BOUGHT;
-- expiry says whether it still counts. Access is granted only when
-- tier <> 'free' AND plan_expires_at > now(). Both the app (plan.ts) and the
-- n8n prompt node check this, because the browser copy is advisory.
--
-- Run order (all idempotent):
--   1..7 as before, then:
--   8. upgrade-8-plan-expiry.sql   (this file)
-- ============================================================

alter table profiles add column if not exists plan_started_at timestamptz;
alter table profiles add column if not exists plan_expires_at timestamptz;
alter table profiles add column if not exists plan_cycle text
  check (plan_cycle in ('monthly','yearly'));

-- Every existing paid profile gets a real date instead of "forever".
-- Anyone already on pro/team is credited 30 days from now rather than being
-- cut off mid-use — they paid in good faith under the old rules.
update profiles
   set plan_started_at = coalesce(plan_started_at, now()),
       plan_expires_at = coalesce(plan_expires_at, now() + interval '30 days'),
       plan_cycle      = coalesce(plan_cycle, 'monthly')
 where tier in ('pro','team');

create index if not exists idx_profiles_plan_expiry
  on profiles(plan_expires_at) where tier <> 'free';

-- ------------------------------------------------------------
-- READABLE VIEWS — open these in Table Editor and understand the
-- account at a glance. Plain columns, no JSON to squint at.
-- ------------------------------------------------------------

-- Who is on what, and is it still valid?
create or replace view v_plans_readable as
select
  p.display_name                                   as builder,
  p.email,
  case when p.tier = 'free' then 'Free'
       else 'Pro' end                              as plan,
  case
    when p.tier = 'free'                     then 'free tier'
    when p.plan_expires_at is null           then 'NO EXPIRY SET — check this'
    when p.plan_expires_at > now()           then 'active'
    when p.plan_expires_at > now() - interval '3 days' then 'in grace period'
    else 'EXPIRED — downgraded to free'
  end                                              as status,
  p.plan_cycle                                     as billing,
  to_char(p.plan_expires_at, 'DD Mon YYYY')        as renews_on,
  greatest(0, date_part('day', p.plan_expires_at - now()))::int as days_left,
  to_char(p.plan_started_at, 'DD Mon YYYY')        as started
from profiles p
order by p.plan_expires_at desc nulls last;

-- What each builder has spent this window, in words rather than counts.
create or replace view v_credits_readable as
select
  p.display_name                                   as builder,
  case when p.tier = 'free' then 'Free' else 'Pro' end as plan,
  coalesce(u.chat_today, 0)                        as copilot_used_today,
  case when p.tier = 'free' then 8 else 30 end     as copilot_allowed_today,
  coalesce(u.writes_week, 0)                       as posts_used_this_week,
  case when p.tier = 'free' then 5 else 35 end     as posts_allowed_this_week,
  coalesce(u.writes_month, 0)                      as posts_used_this_month,
  case when p.tier = 'free' then 20 else 100 end   as posts_allowed_this_month,
  to_char(u.last_call, 'DD Mon HH24:MI')           as last_ai_call
from profiles p
left join v_ai_usage_now u on u.user_id = p.id
order by u.last_call desc nulls last;
