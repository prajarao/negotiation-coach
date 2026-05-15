-- Allow student_plus in users + subscriptions (required for Indian pilot + Student Plus SKU).
-- Run once in Supabase SQL Editor if your DB was created from an older supabase-schema.sql.
-- Safe to re-run: drops named constraints then re-adds.

alter table public.users drop constraint if exists users_plan_check;
alter table public.users
  add constraint users_plan_check check (plan in ('free', 'sprint', 'pro', 'student_plus'));

alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions
  add constraint subscriptions_plan_check check (plan in ('free', 'sprint', 'pro', 'student_plus'));

notify pgrst, 'reload schema';
