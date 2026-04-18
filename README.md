# OfferAdvisor

OfferAdvisor is an AI-powered salary and compensation negotiation coach.

It combines:
- AI chat coaching
- salary benchmarking
- counter-offer calculation
- recruiter role-play practice
- outcome tracking
- plan-based feature access (free/sprint/pro)

## Tech Stack

- Frontend: React + Vite
- Auth: Clerk
- Payments: Stripe
- Database: Supabase
- Email: Resend
- AI: Groq chat completions API
- Deployment: Vercel (serverless API routes)

## Repository Structure

- `src/`
  - `App.jsx` - main product UI and tab flows
  - `main.jsx` - app bootstrap + Clerk provider
  - `AuthModal.jsx` - sign in/up + upgrade modal
  - `utils/sessionEmail.js` - client helper for session-summary emails
  - `components/CrispChat.jsx` - Crisp support widget
- `api/` (Vercel serverless routes)
  - `chat.js` - AI coaching endpoint
  - `salary.js` - salary benchmark endpoint
  - `checkout.js` - Stripe checkout session creation
  - `stripe-webhook.js` - payment webhook handling
  - `clerk-webhook.js` - Clerk user sync webhook
  - `send-plan-confirmation.js` - plan/welcome emails
  - `send-session-summary.js` - session summary emails
  - `_plan-gate.js` - server-side feature and usage gating
  - `_supabase.js` - shared Supabase admin client
- `supabase-schema.sql` - DB schema and RLS policies
- `scripts/regression.js` - regression test suite
- `app.html` - Vite app entry HTML
- `vite.config.js` - build input and Vite config
- `vercel.json` - Vercel rewrite rules

## Product Modules

`src/App.jsx` exposes five main tabs:

- `coach` - chat-first offer coaching
- `benchmark` - market percentile lookup
- `calculate` - counter-offer and 4-year comp analysis
- `practice` - recruiter role-play mode
- `logwin` - negotiation outcome logging and stats

Plan access is enforced:
- client-side in UI tab locks
- server-side in `api/_plan-gate.js`

## Plans & access

| Plan | Stripe metadata `plan` | Access window |
|------|------------------------|----------------|
| **Offer Sprint** | `sprint` | **30 days** from successful checkout. Clerk `publicMetadata.expiresAt` and `planExpiresAt` are set to the same ISO end timestamp; Supabase `users.plan_expires_at` matches. The app shows a Sprint countdown and treats expired Sprint as free for gating. |
| **Offer in Hand** | `pro` | **No fixed expiration** — `expiresAt` / `planExpiresAt` and `plan_expires_at` are cleared (`null`). |

Implementation touchpoints: `api/stripe-webhook.js` (sets Clerk metadata + Supabase after payment), `api/clerk-webhook.js` (syncs `plan_expires_at` on `user.updated`), `src/App.jsx` (Sprint expiry UI and `effectivePlan`), `api/_plan-gate.js` (API checks using `plan` + `plan_expires_at`).

Pro also unlocks extra tabs in the UI (`templates`, `playbook`, `history`) beyond the five core tool tabs; see `PLAN_FEATURES` in `src/App.jsx`.

## Environment Variables

Set these in local `.env` and in Vercel project settings.

### Frontend
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CRISP_WEBSITE_ID` (optional)

### AI
- `GROQ_API_KEY`

### Stripe
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_SPRINT_PRICE_ID`
- `STRIPE_PRO_PRICE_ID`

### Clerk
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`

### Supabase
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

### Email
- `RESEND_API_KEY`

### App URL
- `NEXT_PUBLIC_APP_URL`
- `VERCEL_URL` (provided by Vercel at runtime)

## Local Development

Install dependencies:

`npm install`

Run frontend dev server:

`npm run dev`

Build production assets:

`npm run build`

## Deployment Notes

- Vite builds using `app.html` as the entry (see `vite.config.js`).
- Vercel rewrites `/app` routes to `app.html` (see `vercel.json`).
- Production API is expected to run from `api/` serverless functions.
- `server.js` exists as an alternate local Express backend flow.

## Data Model

Schema is defined in `supabase-schema.sql`.

Core tables:
- `users` - clerk identity, plan, usage, expiry
- `subscriptions` - plan/payment history

Includes:
- Row Level Security policies
- helper RPC `increment_usage`

## Regression Testing

Predeploy script:

`npm run predeploy`

This runs `scripts/regression.js` against a production URL configured in `package.json`.

Same check locally:

`npm run regression:prod`

Optional: pass a Clerk session JWT so auth-gated salary tests run (not skipped):

`REGRESSION_AUTH_TOKEN=<jwt> node scripts/regression.js --env production --url https://your-host.vercel.app`

## CI/CD (GitHub + Vercel)

Workflow: `.github/workflows/ci.yml`

| Trigger | What runs |
|--------|------------|
| **Pull request** to `main` | `npm ci`, `npm run build`. If repo variable `REGRESSION_PREVIEW_URL` is set, also runs full regression against that URL and uploads a report artifact. |
| **Push** to `main` | `npm ci`, `npm run build`, **90s wait** (so Vercel can deploy the new commit), then full regression against production (URL from `VERCEL_PRODUCTION_URL` or default pearl host), uploads report. |
| **workflow_dispatch** | Manually run build + regression; choose URL and whether to skip the deploy wait. |

### GitHub configuration

1. **Secrets** (Settings → Secrets and variables → Actions → Secrets)  
   - `REGRESSION_AUTH_TOKEN` — optional Clerk JWT for a test user with paid features so benchmark tests do not skip in CI.

2. **Variables** (same place → Variables)  
   - `VERCEL_PRODUCTION_URL` — optional; overrides default production base URL used on `main`.  
   - `REGRESSION_PREVIEW_URL` — optional; if set, PR workflow runs regression against this URL (e.g. a stable staging deployment).

3. **Branch protection** (`main`)  
   - Require pull request before merging.  
   - Require status checks: **PR build** (and preview regression if you enable the variable).  
   - Do not allow force-push without justification.

### End-to-end developer flow

1. Work in a feature branch; run `npm run build` locally in Cursor if you like.  
2. Push branch → open PR → CI must pass → merge to `main`.  
3. Vercel deploys `main` to production.  
4. GitHub Actions on `main` waits briefly, then runs production regression; fix forward or revert if it fails.

## End-to-End Flow (High Level)

1. User interacts with React app.
2. App calls serverless APIs (`/api/chat`, `/api/salary`, etc.).
3. Plan-gate validates access and usage.
4. Stripe checkout upgrades user plan.
5. Stripe webhook updates Clerk metadata + Supabase.
6. Clerk webhook keeps user data synchronized.
7. Resend sends transactional and session-summary emails.
