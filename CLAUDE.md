# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repository root using `pnpm` and `nx`.

```bash
# Dev server (platform app)
pnpm nx dev vectreal-platform

# Build
pnpm nx build vectreal-platform

# Lint
pnpm nx lint vectreal-platform
pnpm nx affected --target=lint          # only affected projects

# Tests
pnpm nx test vectreal-platform          # run all tests for the platform app
pnpm nx affected --target=test          # only affected projects

# Type-check
pnpm nx typecheck vectreal-platform     # runs react-router typegen + tsc --noEmit

# Drizzle migrations
pnpm nx run vectreal-platform:drizzle-generate

# Supabase (local)
pnpm supabase start
pnpm nx run vectreal-platform:supabase-db-reset

# Deploy DB schema
pnpm nx run vectreal-platform:supabase-db-push-staging
pnpm nx run vectreal-platform:supabase-db-push-prod
```

Always run tasks via `nx` rather than the underlying tool (e.g. use `nx lint`, not `eslint` directly).

## Monorepo Structure

```
apps/vectreal-platform/    # Full-stack React Router v7 SSR app
packages/
  viewer/                  # @vctrl/viewer — React 3D viewer component
  hooks/                   # @vctrl/hooks — browser-side model loading/optimization
  core/                    # @vctrl/core — Node.js server-side model processing
shared/
  components/              # Shared Radix UI / shadcn-based component library
  utils/                   # Shared utility functions
terraform/                 # GCP Cloud Run, CDN, IAM, storage (Terraform)
```

Internal package dependencies use `workspace:*` and must not be pinned to registry versions.

## Platform App Architecture (`apps/vectreal-platform/`)

### Framework
React Router v7 in framework mode with SSR. Route config lives in `app/routes.tsx` (not file-based). Route modules live under `app/routes/`.

### Key directories

| Path | Purpose |
|------|---------|
| `app/routes/` | All route modules (pages + API routes) |
| `app/routes/api/` | Server-only API endpoints (auth, billing, scenes, etc.) |
| `app/routes/layouts/` | Shared layout wrappers |
| `app/routes/dashboard-page/` | Dashboard routes (projects, billing, settings, etc.) |
| `app/lib/domain/` | Business logic (auth, billing, asset, organization, project, scene, user) |
| `app/lib/sessions/` | Cookie-based session helpers (auth, CSRF, consent, theme) |
| `app/lib/http/` | Request parsing and response utilities |
| `app/db/` | Drizzle ORM client (`client.ts`) and schema (`schema/`) |
| `app/constants/` | Plan config (`plan-config.ts`), feature flags, etc. |
| `app/components/` | App-level React components |
| `app/hooks/` | App-level React hooks |

### Auth pattern
`loadAuthenticatedUser(request)` returns `{ user, userWithDefaults, headers }`. Current org is at `userWithDefaults.organization.id`. Role check: `getUserOrganizations(user.id)` → find membership → check `owner | admin`.

### Billing architecture
- `orgSubscriptions` table is the single source of truth for plan state.
- `syncSubscriptionFromStripe()` upserts by `organizationId`.
- Checkout flow (`app/routes/api/billing/checkout.ts`): if `billingState === 'active'` and `stripeSubscriptionId` exists → `stripe.subscriptions.update()` (proration); otherwise → Stripe Checkout session.
- Response field: `{ redirectUrl }`.
- Success page (`billing-upgrade-success.tsx`): `?session_id=xxx` → Stripe Checkout path (calls `syncCompletedCheckout()`); `?plan_id=xxx&billing_period=xxx&from_plan=xxx` → direct-update path (DB already synced).
- Stripe webhooks handled in `app/lib/domain/billing/stripe-subscription-sync.server.ts` as async fallback.
- Plans: `free | pro | business | enterprise`. Entitlements/limits defined in `app/constants/plan-config.ts`.

### Database
Drizzle ORM over Supabase PostgreSQL. Schema modules under `app/db/schema/` (auth, billing, consent, core, project, shared). Generate a new migration with `pnpm nx run vectreal-platform:drizzle-generate`, then push to staging/prod with the supabase-db-push targets.

### Shared UI
Components are in `shared/components/ui/` (shadcn-based, Radix UI primitives). Import as `@shared/components/ui/*`.

## Conventions

- **Commits**: Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
- **Versioning**: Managed by Release Please. Do not use `nx release`. Use `workspace:*` for internal deps.
- **Docs pages**: MDX files in `app/routes/docs/`. Adding a new page also requires a nav entry in the docs layout.
- **Server-only modules**: Files that must not be bundled client-side are named `*.server.ts`.
