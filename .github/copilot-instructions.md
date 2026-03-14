# GitHub Copilot — Repository Instructions

> These instructions are automatically included in every GitHub Copilot Chat session for this repository.

---

## Repository Overview

Vectreal Platform is an open platform for preparing, managing, and publishing 3D content for the web.
It is a **pnpm + Nx monorepo** containing:

| Area | Path | Purpose |
|------|------|---------|
| Platform app | `apps/vectreal-platform/` | Full-stack React Router v7 app (SSR, auth, dashboard, publisher, preview) |
| Viewer package | `packages/viewer/` | `@vctrl/viewer` React 3D viewer component |
| Hooks package | `packages/hooks/` | `@vctrl/hooks` browser-side loading, optimisation, and export hooks |
| Core package | `packages/core/` | `@vctrl/core` server-side model processing pipeline |
| Shared libraries | `shared/` | Shared UI components and utilities |
| Infrastructure | `terraform/` | Google Cloud Run, CDN, IAM, and storage Terraform config |

---

## Productization Context

All productization decisions live under **`prd/`** at the repository root.
Read the relevant document before implementing any feature that touches:

- plans or tiers → [`prd/01-plans-and-tiers.md`](prd/01-plans-and-tiers.md)
- resource limits or quotas → [`prd/02-limits-and-quotas.md`](prd/02-limits-and-quotas.md)
- feature flags or entitlements → [`prd/03-entitlements.md`](prd/03-entitlements.md)
- billing, subscriptions, or payment states → [`prd/04-billing-states.md`](prd/04-billing-states.md)
- cookies, consent, or privacy → [`prd/05-consent-categories.md`](prd/05-consent-categories.md)
- analytics events, tracking, or telemetry → [`prd/06-analytics-event-taxonomy.md`](prd/06-analytics-event-taxonomy.md)

**Canonical identifiers** (plan ids, entitlement keys, billing state ids, consent categories, event names) defined in the PRD are the **only** accepted string literals in code. Do not invent new identifiers without updating the PRD first.

---

## Key Conventions

### Framework
- The platform app uses **React Router v7 framework mode** (not client-side SPA). Follow framework-mode conventions: loaders, actions, `Route.LoaderArgs`, `Route.ActionArgs`.
- Use **Drizzle ORM** for all database access. Schemas live in `apps/vectreal-platform/app/db/schema/`.

### Nx Tasks
- Run tasks via `nx` (e.g., `nx run vectreal-platform:build`) — never call underlying tools (tsc, vite, jest) directly.
- `nx affected` for CI-scoped runs.

### Code Style
- TypeScript strict mode everywhere.
- Format on save via Prettier. ESLint with auto-fix on save.
- Imports use path aliases from `tsconfig.base.json`.

### Testing
- Unit tests: Jest (`nx run <project>:test`).
- E2E tests: Playwright (`nx run <project>:e2e`).

---

## Agent Skills Available

The following Nx-aware MCP tools are available in this workspace:

- `nx_workspace` — workspace architecture overview and error detection
- `nx_project_details` — per-project structure and dependencies
- `nx_docs` — up-to-date Nx documentation

Use these tools when answering questions about project configuration, graph errors, or Nx best practices.
