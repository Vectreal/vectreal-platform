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

| Path                         | Purpose                                                                   |
| ---------------------------- | ------------------------------------------------------------------------- |
| `app/routes/`                | All route modules (pages + API routes)                                    |
| `app/routes/api/`            | Server-only API endpoints (auth, billing, scenes, etc.)                   |
| `app/routes/layouts/`        | Shared layout wrappers                                                    |
| `app/routes/dashboard-page/` | Dashboard routes (projects, billing, settings, etc.)                      |
| `app/lib/domain/`            | Business logic (auth, billing, asset, organization, project, scene, user) |
| `app/lib/sessions/`          | Cookie-based session helpers (auth, CSRF, consent, theme)                 |
| `app/lib/http/`              | Request parsing and response utilities                                    |
| `app/db/`                    | Drizzle ORM client (`client.ts`) and schema (`schema/`)                   |
| `app/constants/`             | Plan config (`plan-config.ts`), feature flags, etc.                       |
| `app/components/`            | App-level React components                                                |
| `app/hooks/`                 | App-level React hooks                                                     |

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

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
