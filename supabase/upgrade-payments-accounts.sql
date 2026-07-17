-- ============================================================
-- SUPER DENT X — UPGRADE: payments table + account fields
-- Run AFTER schema.sql in: Supabase → SQL Editor → paste → Run
-- Safe to re-run any time.
-- ============================================================

-- Profiles: fields for onboarding + receipts
alter table profiles add column if not exists email text;
alter table profiles add column if not exists start_stage text
  check (start_stage in ('spark','building','launched'));

-- PAYMENTS — every Paystack checkout lands here the second it succeeds.
-- WHERE TO LOOK: Supabase → Table Editor → payments
--   email        → who paid
--   amount_kobo  → amount ×100 (₦5,000 = 500000)
--   tier / cycle → what they bought (Pro / CEO Mode, monthly / yearly)
--   paystack_ref → the reference to cross-check in your Paystack dashboard
--   status       → 'success-client' (app saw it) → 'verified' (n8n confirmed
--                  it with the SECRET key — the source of truth for money)
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  email text not null,
  amount_kobo bigint not null,
  currency text not null default 'NGN',
  tier text,
  cycle text,
  paystack_ref text unique,
  status text not null default 'success-client',
  verified_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_payments_created on payments(created_at desc);

alter table payments enable row level security;
-- Anyone may WRITE a payment record (even not-logged-in payers);
-- only you (dashboard / service role / n8n) can read them.
drop policy if exists "insert payments" on payments;
create policy "insert payments" on payments for insert with check (true);
drop policy if exists "own payments" on payments;
create policy "own payments" on payments for select using (auth.uid() = user_id);

-- ============================================================
-- YOUR DATA MAP — where to look for what (Table Editor):
--   profiles          → every user: name, email, project, stage, tier
--   ship_events       → everything users log (title, category, description)
--   daily_logs        → evening close-outs: energy, mood, built/blocked/learned
--   changelog_entries → published changelogs
--   content_pieces    → posts the AI wrote for them
--   payments          → money (see columns above)
--   telemetry         → anonymous product analytics (what features get used)
-- Passwords are NOT visible anywhere — Supabase stores only bcrypt hashes
-- (auth.users.encrypted_password). Nobody can read them, including you.
-- That's the industry standard and it protects YOU legally.
-- ============================================================
