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

-- 5. RPC function to atomically increment usage_count
create or replace function public.increment_usage(p_clerk_id text)
returns void as $$
begin
  update public.users
  set usage_count = usage_count + 1,
      updated_at = now()
  where clerk_id = p_clerk_id;
end;
$$ language plpgsql security definer;

-- 6. Auto-update updated_at on users table
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

-- ============================================================
-- 7. University partnership tables (student verification)
--    Run after initial schema. Only server-side API uses service-role key.
-- ============================================================

create table if not exists public.universities (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_universities_slug on public.universities (slug);

create table if not exists public.university_domains (
  id              uuid primary key default gen_random_uuid(),
  university_id   uuid not null references public.universities (id) on delete cascade,
  domain          text not null,
  unique (domain)
);

create index if not exists idx_university_domains_domain on public.university_domains (domain);

create table if not exists public.university_invite_codes (
  id              uuid primary key default gen_random_uuid(),
  university_id   uuid not null references public.universities (id) on delete cascade,
  code_hash       text not null,
  expires_at      timestamptz,
  max_uses        integer not null default 100,
  uses_count      integer not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (code_hash)
);

create index if not exists idx_university_invite_codes_lookup on public.university_invite_codes (university_id, code_hash);

create table if not exists public.university_student_verifications (
  id               uuid primary key default gen_random_uuid(),
  clerk_id         text not null,
  university_id    uuid not null references public.universities (id) on delete cascade,
  invite_code_id   uuid references public.university_invite_codes (id) on delete set null,
  verified_at      timestamptz not null default now(),
  unique (clerk_id, university_id)
);

create index if not exists idx_univ_student_verifications_clerk on public.university_student_verifications (clerk_id);

alter table public.universities enable row level security;
alter table public.university_domains enable row level security;
alter table public.university_invite_codes enable row level security;
alter table public.university_student_verifications enable row level security;

-- Atomically consume one invite use when verification succeeds (race-safe).
create or replace function public.claim_university_invite(p_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.university_invite_codes
  set uses_count = uses_count + 1
  where id = p_invite_id
    and active = true
    and (expires_at is null or expires_at > now())
    and uses_count < max_uses;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- ── Demo seed (two schools). Invite codes are SHA256(lowercase trimmed input):
--    pilot2026   → b778c0b7463af0f06587126aa9ef21dc9b1eb2085826c960957b9021f459b372
--    secondkey   → e994ce0c7603143a113d74d34012c7573412464af6969aa2f342eef166f01e57
--    state-demo-invite-only → acd7f4cdad4b46cb6442f2169cdd7593e4b1f486e3e91bddf18c293bf24e76d9
--    tech-demo-invite-only  → 27ad533a6141db17747e3492a2ffd89576a3aaafb8115b9151e523d30ce640b8

insert into public.universities (slug, name, active)
values
  ('demo-state', 'State University (demo)', true),
  ('demo-tech', 'Tech Institute (demo)', true)
on conflict (slug) do nothing;

insert into public.university_domains (university_id, domain)
select u.id, 'student.demo-state.edu' from public.universities u where u.slug = 'demo-state'
on conflict (domain) do nothing;

insert into public.university_domains (university_id, domain)
select u.id, 'mail.demo-tech.edu' from public.universities u where u.slug = 'demo-tech'
on conflict (domain) do nothing;

insert into public.university_invite_codes (university_id, code_hash, expires_at, max_uses, uses_count, active)
select u.id, 'b778c0b7463af0f06587126aa9ef21dc9b1eb2085826c960957b9021f459b372', null, 1000, 0, true
from public.universities u where u.slug = 'demo-state'
on conflict (code_hash) do nothing;

insert into public.university_invite_codes (university_id, code_hash, expires_at, max_uses, uses_count, active)
select u.id, 'e994ce0c7603143a113d74d34012c7573412464af6969aa2f342eef166f01e57', null, 1000, 0, true
from public.universities u where u.slug = 'demo-tech'
on conflict (code_hash) do nothing;

-- Invite-only (no institutional email): globally unique codes — use these when students have no @school inbox
insert into public.university_invite_codes (university_id, code_hash, expires_at, max_uses, uses_count, active)
select u.id, 'acd7f4cdad4b46cb6442f2169cdd7593e4b1f486e3e91bddf18c293bf24e76d9', null, 500, 0, true
from public.universities u where u.slug = 'demo-state'
on conflict (code_hash) do nothing;

insert into public.university_invite_codes (university_id, code_hash, expires_at, max_uses, uses_count, active)
select u.id, '27ad533a6141db17747e3492a2ffd89576a3aaafb8115b9151e523d30ce640b8', null, 500, 0, true
from public.universities u where u.slug = 'demo-tech'
on conflict (code_hash) do nothing;

-- ============================================================
-- 8. Migration — globally unique invite codes (existing databases only)
--    Run once if your DB still has unique(university_id, code_hash) from an older schema.
--    Skip if university_invite_codes was created with unique(code_hash) already.
-- ============================================================
alter table public.university_invite_codes
  drop constraint if exists university_invite_codes_university_id_code_hash_key;

create unique index if not exists university_invite_codes_code_hash_uidx
  on public.university_invite_codes (code_hash);

-- ============================================================
-- 9. Reload PostgREST API schema (fixes PGRST205 after creating tables)
--    Run once after section 7 if REST still says table not in schema cache.
-- ============================================================
notify pgrst, 'reload schema';
