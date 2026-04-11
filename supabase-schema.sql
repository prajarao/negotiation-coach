-- ============================================================
-- OfferAdvisor — Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Users table — one row per Clerk user
create table if not exists public.users (
  id              uuid default gen_random_uuid() primary key,
  clerk_id        text unique not null,
  email           text,
  plan            text not null default 'free'
                    check (plan in ('free', 'sprint', 'pro')),
  usage_count     integer not null default 0,
  plan_expires_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Index for fast lookups by Clerk ID (used on every API call)
create index if not exists idx_users_clerk_id on public.users (clerk_id);

-- 2. Subscriptions table — payment / plan-change history
create table if not exists public.subscriptions (
  id                uuid default gen_random_uuid() primary key,
  clerk_id          text not null references public.users (clerk_id) on delete cascade,
  plan              text not null check (plan in ('free', 'sprint', 'pro')),
  status            text not null default 'active'
                      check (status in ('active', 'expired', 'cancelled')),
  stripe_session_id text,
  amount_cents      integer,
  started_at        timestamptz not null default now(),
  expires_at        timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_subscriptions_clerk_id on public.subscriptions (clerk_id);

-- 3. Enable Row Level Security
alter table public.users enable row level security;
alter table public.subscriptions enable row level security;

-- 4. RLS policies — users can only read/write their own row
--    The Supabase service-role key bypasses RLS, so server-side
--    (webhook, API routes) can still read/write any row.

-- Users: select own row
create policy "Users can read own row"
  on public.users for select
  using (clerk_id = current_setting('request.jwt.claims', true)::json ->> 'sub');

-- Users: update own row
create policy "Users can update own row"
  on public.users for update
  using (clerk_id = current_setting('request.jwt.claims', true)::json ->> 'sub');

-- Subscriptions: select own rows
create policy "Users can read own subscriptions"
  on public.subscriptions for select
  using (clerk_id = current_setting('request.jwt.claims', true)::json ->> 'sub');

-- 5. Auto-update updated_at on users table
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.users
  for each row
  execute function public.handle_updated_at();
