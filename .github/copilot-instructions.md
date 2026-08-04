# GitHub Copilot — Repository Instructions

> These instructions are automatically included in every GitHub Copilot Chat session for this repository.

---

## Repository Overview

Vectreal Platform is an open platform for preparing, managing, and publishing 3D content for the web.
It is a **pnpm + Nx monorepo** containing:

| Area             | Path                      | Purpose                                                                   |
| ---------------- | ------------------------- | ------------------------------------------------------------------------- |
| Platform app     | `apps/vectreal-platform/` | Full-stack React Router v7 app (SSR, auth, dashboard, publisher, preview) |
| Viewer package   | `packages/viewer/`        | `@vctrl/viewer` React 3D viewer component                                 |
| Hooks package    | `packages/hooks/`         | `@vctrl/hooks` browser-side loading, optimisation, and export hooks       |
| Core package     | `packages/core/`          | `@vctrl/core` isomorphic model processing pipeline                        |
| Shared libraries | `shared/`                 | Shared UI components and utilities                                        |
| Infrastructure   | `terraform/`              | Cloudflare DNS, Turnstile widgets, cache rules, and page rules            |

---

## Productization Context

There is no PRD directory. Productization decisions live in code, and these files are the source of truth:

- plans, tiers, entitlement keys, limit keys, billing states → [`apps/vectreal-platform/app/constants/plan-config.ts`](../apps/vectreal-platform/app/constants/plan-config.ts)
- user-facing product claims, plan copy, supported formats → [`apps/vectreal-platform/app/constants/product-copy.ts`](../apps/vectreal-platform/app/constants/product-copy.ts)
- role → operation authorization → [`apps/vectreal-platform/app/lib/domain/dashboard/dashboard-operations.ts`](../apps/vectreal-platform/app/lib/domain/dashboard/dashboard-operations.ts)
- cookies and consent categories → [`apps/vectreal-platform/app/lib/consent/consent-cookie.ts`](../apps/vectreal-platform/app/lib/consent/consent-cookie.ts)
- analytics events → the `capture` call sites themselves; there is no separate registry

**Canonical identifiers** (plan ids, entitlement keys, billing state ids, consent categories) come from the types in those files. Adding one means adding it to the type, so a missing case is a compile error. Do not invent string literals that no type admits.

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

- Unit tests: Vitest (`nx run <project>:test`), with the config in each project's `vite.config.ts` `test` block.
- E2E tests: Playwright (`nx run <project>:e2e`).

---

## Agent Skills Available

The following Nx-aware MCP tools are available in this workspace:

- `nx_workspace` — workspace architecture overview and error detection
- `nx_project_details` — per-project structure and dependencies
- `nx_docs` — up-to-date Nx documentation

The following repository skills are also available:

- [vectreal-extension-architecture](.agents/skills/vectreal-extension-architecture/SKILL.md) — use for architecture and extension work (route trees, loaders/actions, domain boundaries, client/server separation, Drizzle/RLS, Nx workflow discipline).
- [vectreal-brand-ux-design](.agents/skills/vectreal-brand-ux-design/SKILL.md) — use for UI/UX and branding work (token-first styling, typography, motion, accessibility, responsive behavior, intentional and high-polish design execution).
- [vectreal-iterative-delivery](.agents/skills/vectreal-iterative-delivery/SKILL.md) — use for ambiguity reduction, phased execution, mandatory implementation→verification→autonomous review→plan alignment loops, exhaustive per-iteration verification coverage, sub-agent-assisted validation when work is cross-cutting, and required loop evidence blocks before completion claims.

Use these tools when answering questions about project configuration, graph errors, or Nx best practices.
