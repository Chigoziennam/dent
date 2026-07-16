-- ============================================================
-- NALTO SHIPLOG — SUPABASE SCHEMA
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- Safe to run alongside your SchoolOS tables — no name collisions.
-- ============================================================

create extension if not exists "pgcrypto";

-- ENUMS ------------------------------------------------------
do $$ begin
  create type event_source as enum
    ('github','vercel','stripe','linear','supabase','notion','slack','discord','n8n','manual','ai_detected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_category as enum
    ('commit','deployment','feature','bugfix','revenue','customer','milestone','learning','blocker','idea','launch','integration','design','content','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type content_status as enum ('draft','scheduled','published','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type content_platform as enum
    ('twitter','linkedin','newsletter','changelog','blog','threads','devto','producthunt','resume');
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_tier as enum ('free','pro','team');
exception when duplicate_object then null; end $$;

-- 1. PROFILES (extends auth.users) --------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  bio text,
  website text,
  twitter_handle text,
  github_username text,
  current_project_name text,
  current_project_tagline text,
  timezone text default 'Africa/Lagos',
  tier subscription_tier default 'free',
  default_tone text default 'founder',
  theme text default 'dark',
  streak_current int default 0,
  streak_longest int default 0,
  streak_last_date date,
  builder_score int default 0,
  builder_level int default 1,
  total_ships int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_profiles_username on profiles(username);
create index if not exists idx_profiles_github on profiles(github_username);

-- 2. INTEGRATIONS --------------------------------------------
-- NOTE: OAuth tokens for captures live in n8n's encrypted vault,
-- NOT here. This table only tracks connection status per user.
create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null,
  provider_username text,
  is_active boolean default true,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  unique (user_id, provider)
);

-- 3. SHIP EVENTS (the atomic unit) ---------------------------
create table if not exists ship_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  source event_source not null default 'manual',
  category event_category not null default 'other',
  title text not null,
  description text,
  metadata jsonb default '{}',
  importance smallint default 5 check (importance between 1 and 10),
  is_pinned boolean default false,
  event_date date not null default current_date,
  event_time timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists idx_events_user_date on ship_events(user_id, event_date desc);
create index if not exists idx_events_category on ship_events(category);

-- 4. DAILY LOGS (the evening logbook) ------------------------
create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  log_date date not null default current_date,
  what_i_built text,
  what_blocked_me text,
  what_i_learned text,
  energy_level smallint check (energy_level between 1 and 5),
  mood text check (mood in ('fire','good','meh','tough','burned_out')),
  ai_summary text,
  created_at timestamptz default now(),
  unique (user_id, log_date)
);
create index if not exists idx_dailylogs_user_date on daily_logs(user_id, log_date desc);

-- 5. WEEKLY DIGESTS ------------------------------------------
create table if not exists weekly_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  event_count int default 0,
  ai_narrative text,
  ai_tweet text,
  ai_linkedin text,
  ai_changelog text,
  ai_newsletter text,
  is_published boolean default false,
  created_at timestamptz default now(),
  unique (user_id, week_start)
);

-- 6. CONTENT PIECES ------------------------------------------
create table if not exists content_pieces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  digest_id uuid references weekly_digests(id),
  platform content_platform not null,
  tone text default 'founder',
  title text,
  body text not null,
  status content_status default 'draft',
  scheduled_for timestamptz,
  published_at timestamptz,
  published_url text,
  created_at timestamptz default now()
);
create index if not exists idx_content_user_status on content_pieces(user_id, status);

-- 7. CHANGELOG ENTRIES (public) ------------------------------
create table if not exists changelog_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  version_tag text,
  title text not null,
  body text not null,
  is_public boolean default true,
  published_at timestamptz default now()
);
create index if not exists idx_changelog_user on changelog_entries(user_id, published_at desc);

-- 8. ACHIEVEMENTS --------------------------------------------
create table if not exists user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  code text not null,             -- matches the app's achievement codes
  xp_reward int default 0,
  unlocked_at timestamptz default now(),
  unique (user_id, code)
);

-- 9. NUDGES (the AI companion's one-a-day notes) -------------
create table if not exists nudges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  seen boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_nudges_user on nudges(user_id, created_at desc);

-- VIEWS ------------------------------------------------------
create or replace view v_user_stats as
select
  user_id,
  count(*) as total_events,
  count(*) filter (where category = 'commit') as total_commits,
  count(*) filter (where category = 'deployment') as total_deploys,
  count(*) filter (where category in ('revenue','customer')) as total_revenue_events,
  count(distinct event_date) as active_days,
  max(event_date) as last_event_date
from ship_events
group by user_id;

-- RLS --------------------------------------------------------
alter table profiles enable row level security;
alter table integrations enable row level security;
alter table ship_events enable row level security;
alter table daily_logs enable row level security;
alter table weekly_digests enable row level security;
alter table content_pieces enable row level security;
alter table changelog_entries enable row level security;
alter table user_achievements enable row level security;
alter table nudges enable row level security;

-- Owners can do everything with their own rows
do $$ declare t text;
begin
  foreach t in array array['integrations','ship_events','daily_logs','weekly_digests','content_pieces','changelog_entries','user_achievements','nudges'] loop
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);

-- Public read for proof-of-work pages
drop policy if exists "public profiles" on profiles;
create policy "public profiles" on profiles for select using (true);
drop policy if exists "public changelog" on changelog_entries;
create policy "public changelog" on changelog_entries for select using (is_public);
drop policy if exists "public events" on ship_events;
create policy "public events" on ship_events for select using (true);

-- 10. TELEMETRY (founder analytics — anonymous product signals) --
create table if not exists telemetry (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  props jsonb default '{}',
  device text,
  ua text,
  created_at timestamptz default now()
);
create index if not exists idx_telemetry_event on telemetry(event, created_at desc);
alter table telemetry enable row level security;
-- Anyone may write a signal; only you (service role / dashboard) can read.
drop policy if exists "insert only" on telemetry;
create policy "insert only" on telemetry for insert with check (true);

-- 11. AUTO-PROFILE ON SIGNUP ---------------------------------
-- Creates the profiles row the moment someone signs up (email,
-- GitHub, Google, Apple — any provider). Username derives from
-- email or provider handle; users can change it in Settings.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url, github_username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'user_name',
      new.raw_user_meta_data->>'preferred_username',
      split_part(new.email, '@', 1)
    ) || '_' || left(new.id::text, 4),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'user_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
