---
name: vectreal-extension-architecture
description: 'Use when extending Vectreal platform architecture, adding routes/loaders/actions, introducing domain modules, changing DB access patterns, or refactoring client/server boundaries in React Router v7 framework mode. Triggers: architecture, layout tree, route structure, modularization, separation of concerns, DRY, clean code, server/client split, loader action, Drizzle repository, RLS, Nx conventions.'
---

# Vectreal Extension Architecture

## Mission

Build new features in ways that preserve Vectreal's layout semantics, domain modularity, and framework-mode data flow without introducing unnecessary abstraction overhead.

## Non-Negotiables

1. Keep route and file structure aligned with layout semantics and user journey.
2. Use React Router v7 framework mode patterns (loaders, actions, Route.LoaderArgs, Route.ActionArgs, Route.ComponentProps).
3. Separate server-only code into .server.ts modules and never import server modules into client runtime.
4. Keep data access in domain repositories/services, not directly in route UI modules.
5. Use canonical identifiers from prd documents for plans, entitlements, billing states, consent, and analytics events.
6. Run tasks through Nx via pnpm nx; do not call underlying tooling directly.

## Architectural Principles

1. Layout-driven tree semantics

- Route composition must reflect UX and access boundaries first, file placement second.
- Nested layouts must represent real shared concerns (auth shell, dashboard shell, docs shell), not convenience wrappers.
- Prefer explicit route tree clarity over clever dynamic routing.

2. Modularization without overhead

- Organize by domain responsibility, not arbitrary technical layering.
- Extract modules when they reduce duplication or isolate volatile logic.
- Avoid speculative abstraction: no new shared layers unless at least two concrete callers benefit now.

3. Clean code and DRY by intent

- DRY means deduplicating business meaning, not forcing all similar code into generic helpers.
- Keep orchestrators explicit when domain workflows differ.
- Favor small, composable functions with clear names over generic utility buckets.

4. Strict client/server boundary

- Server concerns: auth, db, secrets, stripe/webhooks, RLS-sensitive queries, request validation.
- Client concerns: rendering, interaction state, optimistic UX, purely visual transforms.
- Crossing boundary must happen through loaders/actions/API routes only.

## Route and Layout Workflow

1. Start from route intent

- Identify destination layout and access level first.
- Place route module where tree semantics remain obvious to future maintainers.

2. Implement loader/action contract

- Use typed args from generated +types.
- Loader returns data for read path; action handles mutation path.
- Keep parsing/validation close to action entry or delegated to domain parser module.

3. Compose UI from stable boundaries

- Route module orchestrates calls to domain functions and UI composition.
- Reusable UI belongs in shared/components or app/components based on scope.

## Domain and Data Workflow

1. Put queries in repository modules

- Repositories own Drizzle query shape and joins.
- Reuse RLS helpers where access checks are required.

2. Put workflow rules in service modules

- Services orchestrate cross-repository behavior and external integrations.
- Services expose explicit domain operations, not low-level transport details.

3. Keep route modules thin

- Route modules should validate input, call domain operations, and produce HTTP/UI responses.

## React Router v7 Framework Mode Rules

1. Prefer loader/action over ad-hoc client fetch for route-owned data.
2. Keep mutation operations in actions or API route actions.
3. Use generated route types; avoid hand-rolled duplicate route typing.
4. Use scoped error boundaries per layout tier when behavior differs between public/auth/dashboard contexts.

## Client and Server Separation Rules

1. Server-only files

- Use .server.ts naming for server-only modules.
- Never import .server.ts into client components, shared client hooks, or browser bundles.

2. API routes

- Keep API route modules server-only and response-focused.
- Centralize auth and CSRF checks with existing helpers.

3. Sessions and secrets

- Cookie/session/secret handling stays server-side only.

## PRD and Identifier Discipline

1. Do not invent new literal identifiers for:

- Plans
- Entitlements
- Billing states
- Consent categories
- Analytics event names

2. If a new identifier is required, update PRD first, then code.

## Nx and Execution Discipline

1. Run lint/test/build/typecheck/migrations through Nx using pnpm nx.
2. Prefer nx run and nx affected workflows consistent with repository conventions.
3. Do not bypass Nx cache/task graph by calling underlying toolchains directly.

## Anti-Patterns and Replacements

1. Anti-pattern: Direct Drizzle queries in route UI module.

- Replace with repository function in domain layer and call through service when needed.

2. Anti-pattern: Shared abstraction created for a single current caller.

- Replace with local explicit code; extract only with proven second use-case.

3. Anti-pattern: Client component importing server utility.

- Replace with loader/action mediated data flow.

4. Anti-pattern: Route tree flattened for convenience.

- Replace with nested layout structure that matches true semantic shells.

5. Anti-pattern: Hardcoded PRD identifiers in ad-hoc strings.

- Replace with canonical constants/maps aligned to PRD docs.

## Practical Extension Recipes

1. Add a new authenticated dashboard feature

- Add/adjust route in route tree under dashboard layout.
- Add loader for read data and action for mutations.
- Place domain queries in repository, orchestrate with service, keep route thin.
- Reuse shared UI primitives and existing error boundary semantics.

2. Add a new API mutation endpoint

- Create server route action under routes/api.
- Validate payload and auth/CSRF up front.
- Call service operation; return consistent JSON shape.

3. Add a new domain capability with DB persistence

- Add schema/type updates where required.
- Add repository methods for data access.
- Add service methods for business logic.
- Wire through route action/loader.

## Review Checklist

1. Does the route placement reflect layout semantics and access boundaries?
2. Are loader/action typed and used instead of ad-hoc client fetch for route-owned data?
3. Is server-only code isolated in .server.ts?
4. Are DB queries in repositories and workflows in services?
5. Are PRD identifiers canonical and unchanged?
6. Were commands run via pnpm nx only?
7. Did this change avoid unnecessary new abstraction layers?

## Source-of-Truth References

- AGENTS.md
- .github/copilot-instructions.md
- CLAUDE.md
- apps/vectreal-platform/app/routes.tsx
- apps/vectreal-platform/app/db/schema/rls.ts
- prd/01-plans-and-tiers.md
- prd/02-limits-and-quotas.md
- prd/03-entitlements.md
- prd/04-billing-states.md
- prd/05-consent-categories.md
- prd/06-analytics-event-taxonomy.md
