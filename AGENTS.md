# AGENTS.md

How to work in this repository. This file is the single source for every coding
agent: `CLAUDE.md` imports it, and `.github/copilot-instructions.md` points here.
Detail lives in the skills below; this file names the rules and where they are
owned.

## How to work here

1. Work in your own git worktree. Use `git -C <path>` for git; never `cd`.
2. Branch `feat/`, `fix/`, `chore/`, `docs/`, `ci/`, `refactor/`, `perf/` or
   `test/` plus a topic. No attribution lines in commits, branch names or PRs.
3. One concern per PR: its description is one sentence without "and".
4. A bug: before editing, write why it exists and what else shares the cause;
   fix it where the cause lives (`vectreal-iterative-delivery`, Bug work).
5. Before pushing: `pnpm test:brief`, `npx prettier --check .`, and typecheck
   and lint on the six projects (the delivery skill's Gates section).
6. UI changes: screenshots at 390 and 1440 wide in the PR.
7. Never raise a budget, threshold or limit silently; name it in the PR.
8. No secrets in code, logs, PR text or notes.
9. Ask before adding an on-screen element nobody asked for.
10. Done means the PR exists and every GitHub check on its head commit passed,
    CodeQL included. Until then, report `CI pending` with the PR link.

## Skills

Invoke the matching skill before starting work, not after getting stuck. They
live in `.agents/skills/`.

| Skill | Invoke when |
| --- | --- |
| `vectreal-extension-architecture` | Adding or changing a route, loader, action, resource route, domain module, repository, service, permission, billing flow, package manifest, or the client/server boundary. |
| `vectreal-brand-ux-design` | Any change a user can see: component styling, layout, tokens, type scale, elevation, stacking, viewport height, motion, empty/loading/error states, responsive or accessibility work. |
| `vectreal-iterative-delivery` | Scoping ambiguous or cross-cutting work, any bug, and shipping any PR. It owns the root cause, the review loop, the gates and the git rules. |

## Commands

All from the repository root, always through `pnpm nx` rather than the
underlying tool. `pnpm test:brief` is the one exception.

```bash
pnpm nx dev vectreal-platform                   # dev server
pnpm test:brief                                 # every project's unit tests, failures only (vitest filters work)
pnpm nx typecheck vectreal-platform             # react-router typegen + tsc --noEmit
pnpm nx lint vectreal-platform
pnpm nx build-ci vectreal-platform              # what CI builds (not `build`)
pnpm nx run vectreal-platform:test-integration  # needs supabase-start first
pnpm nx run vectreal-platform:supabase-start    # local DB, Auth, Storage, Studio
pnpm nx run vectreal-platform:drizzle-generate  # the only way to make a migration
pnpm nx storybook storybook                     # one Storybook for the workspace
```

## Monorepo

```
apps/vectreal-platform/  React Router v7 SSR app (framework mode, routes in app/routes.tsx)
packages/viewer/         @vctrl/viewer, React 3D viewer
packages/hooks/          @vctrl/hooks, browser-side loading and optimization
packages/core/           @vctrl/core, isomorphic model processing
packages/embed/          @vctrl/embed, SDK for embedded previews
shared/components/       shadcn/Radix component library, imported as @shared/components/ui/*
shared/utils/            shared utilities
storybook/               Storybook host; aggregates shared/components, packages/viewer, app/components
terraform/               Cloudflare only: DNS, Turnstile, cache and page rules
```

A real pnpm workspace: internal dependencies are `workspace:*`, shared
third-party versions live once in the `catalog:` block of `pnpm-workspace.yaml`.
Each project's `package.json` declares what its own source imports; the
extension-architecture skill owns the details.

## Where each rule is owned

There is no PRD directory. These files are the source of truth, and identifiers
come from their types, so a missing case is a compile error:

- plans, entitlements, limits, billing states: `apps/vectreal-platform/app/constants/plan-config.ts`
- user-facing product claims and plan copy: `apps/vectreal-platform/app/constants/product-copy.ts`
- accepted 3D formats: `packages/core/src/model-formats/model-formats.ts`, and nowhere else
- role to operation authorization: `apps/vectreal-platform/app/lib/domain/dashboard/dashboard-operations.ts`.
  Postgres RLS is inert for app traffic, so this table is the only
  authorization that runs. Never hand-roll a role check.
- cookies and consent categories: `apps/vectreal-platform/app/lib/consent/consent-cookie.ts`
- analytics events: the `capture` call sites; there is no registry
- design rules: `DESIGN.md` and the brand-ux-design skill

## Conventions

- **Commits:** Conventional Commits. Versioning is Release Please; never `nx release`.
- **Server-only modules** end in `.server.ts`.
- **Migrations** run before the new release starts, so a migration must work
  with the old release still running: add before you read, drop only once
  nothing deployed reads it.
- **Docs pages:** an MDX file in `app/routes/docs/`, a route in `app/routes.tsx`,
  and an entry in `docsPages` in `app/lib/docs/docs-manifest.ts`.

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
