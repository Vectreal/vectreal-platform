# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Skills

Invoke these before starting the matching work, not after getting stuck. They
live in `.agents/skills/` and are symlinked into `.claude/skills/`. `AGENTS.md`
lists them too, but Claude Code does not auto-load that file, which is why this
section exists.

| Skill | Invoke when |
| --- | --- |
| `vectreal-extension-architecture` | Adding or changing a route, loader, action, resource route, domain module, repository, service, permission, or the client/server boundary. |
| `vectreal-brand-ux-design` | Any change a user can see: component styling, layout, tokens, type scale, elevation, motion, empty/loading/error states, responsive or accessibility work. |
| `vectreal-iterative-delivery` | Scoping ambiguous or cross-cutting work, and shipping any PR. It owns the review loop, which is never skipped. |
| `react-router-framework-mode` (global) | Framework-mode API questions: route config, loaders, actions, fetchers, pending UI, error boundaries, type generation. Carries 12 reference files. |

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
pnpm nx test vectreal-platform          # unit tests (coverage always written to coverage/)
pnpm nx run vectreal-platform:test-integration  # DB integration tests; needs the supabase-start target below
pnpm nx affected --target=test          # only affected projects

# Type-check
pnpm nx typecheck vectreal-platform     # runs react-router typegen + tsc --noEmit

# Storybook (one workspace-wide instance; see Monorepo Structure for what it aggregates)
pnpm nx storybook storybook             # dev server
pnpm nx build-storybook storybook       # static build for Chromatic

# Drizzle migrations
pnpm nx run vectreal-platform:drizzle-generate

# Supabase (local): DB, Auth, Storage, Studio
# The Supabase project lives at apps/vectreal-platform/supabase/, so go through the
# Nx target: the CLI would not find config.toml from the repo root.
# There are no Edge Functions in this repo.
pnpm nx run vectreal-platform:supabase-start
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
  viewer/                  # @vctrl/viewer: React 3D viewer component
  hooks/                   # @vctrl/hooks: browser-side model loading/optimization
  core/                    # @vctrl/core: isomorphic 3D model processing (Node.js + browser/Web Worker)
  embed/                   # @vctrl/embed: framework-agnostic SDK for embedded previews
shared/
  components/              # Shared Radix UI / shadcn-based component library
  utils/                   # Shared utility functions
storybook/                 # Standalone Storybook host; owns no stories, aggregates
                           # shared/components, packages/viewer and the platform
                           # app's app/components into one instance
terraform/                 # Cloudflare only: DNS, Turnstile widgets, cache rules, page rules
```

This is a real pnpm workspace: `pnpm-workspace.yaml` lists every project under
`packages:`, so internal dependencies declared `workspace:*` resolve to the local source.

Third-party versions live once, in the `catalog:` block of `pnpm-workspace.yaml`. Any
manifest needing one of those packages writes `"catalog:"` instead of a range, so a bump
happens in one place. `pnpm publish` substitutes both `workspace:` and `catalog:` with real
ranges while packing, which is why no manifest-rewriting script exists. Each published
package points pnpm at its build output with `publishConfig.directory`; publishing from the
build directory itself would fail, because that directory is not a workspace member.

### Project manifests

Every project's `package.json` must list what its own source imports, at the version the
workspace installs. This is not bookkeeping: pnpm resolves an undeclared import by walking
up to the root `node_modules`, so a manifest can be wrong for years and everything still
builds, which is how `@vctrl/core` came to publish `three@^0.177.0` while the repo built
against 0.185.1.

The `@nx/dependency-checks` ESLint rule enforces it, running over every `package.json`
through the projects' `lintFilePatterns`. It reports undeclared imports, declared packages
nothing imports, and versions that disagree with what is installed, and `--fix` writes the
correction, including `catalog:` where the catalog owns that version. Trust it over
hand-editing.

It reads imports, not bundler config, so a package that deliberately bundles a dependency
has to say so. `packages/viewer` bundles `@vctrl/core` and `@shared/*`, and
`packages/embed` uses `@vctrl/viewer` only for types that `vite-plugin-dts` inlines; both
are listed as `ignoredDependencies` in `eslint.config.mts` with the reason. Anything
externalized in a `vite.config.ts` is the opposite case and must be declared: that is what
a consumer installs.

## Platform App Architecture (`apps/vectreal-platform/`)

### Framework

React Router v7 in framework mode with SSR. Route config lives in `app/routes.tsx` (not file-based). Route modules live under `app/routes/`.

### Key directories

| Path                         | Purpose                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `app/routes/`                | All route modules (pages + API routes)                                                                |
| `app/routes/api/`            | Server-only API endpoints (auth, billing, scenes, etc.)                                               |
| `app/routes/layouts/`        | Shared layout wrappers                                                                                |
| `app/routes/dashboard-page/` | Dashboard routes (projects, billing, settings, etc.)                                                  |
| `app/lib/domain/`            | Business logic (auth, billing, asset, organization, project, scene, user)                             |
| `app/lib/sessions/`          | Auth cookie and CSRF session helpers (consent lives in `app/lib/consent/`, theme in `app/lib/theme/`) |
| `app/lib/http/`              | Request parsing and response utilities                                                                |
| `app/db/`                    | Drizzle ORM client (`client.ts`) and schema (`schema/`)                                               |
| `app/constants/`             | Plan config (`plan-config.ts`), feature flags, etc.                                                   |
| `app/components/`            | App-level React components                                                                            |
| `app/hooks/`                 | App-level React hooks                                                                                 |

### Auth pattern

`loadAuthenticatedUser(request)` returns `{ user, userWithDefaults, headers }`. Current org is at `userWithDefaults.organization.id`.

**Authorization**: never hand-roll a role check. `app/lib/domain/dashboard/dashboard-operations.ts` holds the single role → operation table.

- Server: resolve the actor with `resolveProjectMembership` / `resolveSceneMembership` / `resolveSceneFolderMembership` (`dashboard-permissions.server.ts`), then `assertDashboardPermission('scene:delete', membership)`.
- Client: the module is pure and client-safe, so components call `canPerformDashboardOperation` directly to gate affordances. Loaders ship a `DashboardCapabilityMap` from `buildDashboardCapabilities`.
- Adding an operation means adding it to `DashboardOperation` and the table; a missing rule is a compile error.

Note that Postgres RLS is **inert for app traffic**: `db/client.ts` connects with a plain connection string and no `set local role`, so `auth.uid()` is null and every policy is bypassed. This table is the only authorization that runs.

### Dashboard mutations

Create, rename, move and delete for projects, folders and scenes go through `POST /api/dashboard/mutations` (`dashboard-mutations.ts` for the contract, `dashboard-mutations.server.ts` for execution). Client side, use `useDashboardMutations`. Destructive confirmations come from `planDeleteConfirmation` and render via `ConfirmDestructiveDialog`. The server recomputes the required tier itself, so client-supplied state is never trusted.

### Billing architecture

- `orgSubscriptions` table is the single source of truth for plan state.
- `syncSubscriptionFromStripe()` upserts by `organizationId`.
- Checkout flow (`app/routes/api/billing/checkout.ts`): if `billingState === 'active'` and `stripeSubscriptionId` exists → `stripe.subscriptions.update()` (proration); otherwise → Stripe Checkout session.
- Response field: `{ redirectUrl }`.
- Success page (`billing-upgrade-success.tsx`): `?session_id=xxx` → Stripe Checkout path (calls `syncCompletedCheckout()`); `?plan_id=xxx&billing_period=xxx&from_plan=xxx` → direct-update path (DB already synced).
- Stripe webhooks arrive at `app/routes/api/billing/webhook.ts`, which delegates to `processStripeWebhookEvent` in `app/lib/domain/billing/stripe-webhook-processor.server.ts` as async fallback.
- Plans: `free | pro | business | enterprise`. Entitlements/limits defined in `app/constants/plan-config.ts`.

### Database

Drizzle ORM over Supabase PostgreSQL. Schema modules under `app/db/schema/` (auth, billing, consent, core, project, shared). Generate a new migration with `pnpm nx run vectreal-platform:drizzle-generate`, then push to staging/prod with the supabase-db-push targets.

### Shared UI

Components are in `shared/components/src/ui/` (shadcn-based, Radix UI primitives). Import as `@shared/components/ui/*`.

## Conventions

- **Commits**: Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
- **Versioning**: Managed by Release Please. Do not use `nx release`. Internal deps use `workspace:*`; shared third-party versions use `catalog:` and are declared in `pnpm-workspace.yaml`.
- **Docs pages**: MDX files in `app/routes/docs/`. Adding a new page also requires a route in `app/routes.tsx` and an entry in the `docsPages` array in `app/lib/docs/docs-manifest.ts`, which is what `DocsTreeNav` renders.
- **Server-only modules**: Files that must not be bundled client-side are named `*.server.ts`.
- **Viewport height**: Size full-viewport surfaces with `h-dvh` / `min-h-dvh`, or `h-svh` where a shell owns the height and scrolls its own content, as `dashboard-layout.tsx` does. Never Tailwind's `screen` height utilities: they compile to `100vh`, the *large* viewport, which overhangs persistent mobile browser chrome, pushing bottom-anchored UI behind the bar and leaving the page scrolled with no way back when a canvas holds `touch-action: none`. (Spelling those class names out here would be self-defeating: the Tailwind scanner reads this file and would re-emit the very utilities the codebase dropped.)

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
