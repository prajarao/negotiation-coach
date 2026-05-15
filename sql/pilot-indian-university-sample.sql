-- =============================================================================
-- Indian university pilot — sample provisioning (invite-only, 100 seats)
-- =============================================================================
-- BEFORE RUNNING:
-- 1) Apply sql/migration-users-plan-student-plus-constraint.sql if your DB still restricts plan to sprint/pro/free.
-- 2) Choose a plaintext invite code. Hash it with: node scripts/hash-university-invite.mjs "<your-code>"
--    Default below uses plaintext: india-pilot-2026  (hash must match university_invite_codes.code_hash)
-- 3) Replace the university display name with the real institution name.
-- 4) After insert, copy universities.id for the new row and set Vercel env:
--      PILOT_FREE_UNIVERSITY_IDS=<that-uuid>
--    Optional time-boxed pilot access (Clerk + Supabase plan_expires_at):
--      PILOT_FREE_PLAN_EXPIRES_AT=2027-05-01T00:00:00.000Z
--
-- HANDOFF: Share the PLAINTEXT code with the career center only (never commit it).
-- MONITOR: university_invite_codes.uses_count vs max_uses (100). When full, new users get INVITE_EXHAUSTED.
-- ROTATE: Deactivate this row (active=false), insert a new code_hash, update PILOT_FREE if needed.
-- =============================================================================

insert into public.universities (slug, name, active)
values ('pilot-in-india', 'Indian pilot university (replace with real name)', true)
on conflict (slug) do update
  set name = excluded.name,
      active = excluded.active;

insert into public.university_invite_codes (university_id, code_hash, expires_at, max_uses, uses_count, active)
select u.id,
       '4c77ef2c4671b35a77e8bf733ee4071aa05b8a7bad1f6ac37e424692188756c8',
       null,
       100,
       0,
       true
from public.universities u
where u.slug = 'pilot-in-india'
on conflict (code_hash) do update
  set university_id = excluded.university_id,
      max_uses        = excluded.max_uses,
      active          = excluded.active;

-- Copy UUID into PILOT_FREE_UNIVERSITY_IDS:
select id, slug, name from public.universities where slug = 'pilot-in-india';

-- =============================================================================
-- Smoke test (after deploy + env PILOT_FREE_UNIVERSITY_IDS set to id from above)
-- =============================================================================
-- 1) Sign in to the app; open BRIDGE → Campus verification → Invite code only.
-- 2) Enter plaintext: india-pilot-2026  (must match code_hash in this file)
-- 3) POST /api/student-verify-university returns ok; Supabase: invite uses_count += 1,
--    university_student_verifications row exists, users.plan = student_plus when id is allowlisted.
-- 4) At max_uses=100, expect INVITE_EXHAUSTED for new users.
-- =============================================================================
