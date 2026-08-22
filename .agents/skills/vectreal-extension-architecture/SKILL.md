---
name: vectreal-extension-architecture
description: 'Use when extending the Vectreal platform: adding or changing routes, loaders, actions, resource routes, domain modules, repositories, services, permissions, or the client/server boundary in React Router v7 framework mode. Triggers: route, loader, action, fetcher, resource route, API endpoint, authorization, permission, role check, Drizzle, repository, service, .server.ts, RLS, client/server split, Nx target.'
---

# Vectreal Extension Architecture

## Authorization: read this before writing any access check

**Postgres RLS is inert for application traffic.** `app/db/client.ts` connects
with a plain `DATABASE_URL` and never issues `set local role`, so `auth.uid()`
is null on every app query and every policy is bypassed.

The policies are real. They are declared with `pgPolicy` across
`app/db/schema/**` and built from predicate helpers in `app/db/schema/rls.ts`:
`isUserSelf`, `isOrganizationMember`, `isOrganizationAdmin`, `canAccessProject`.
Those names read exactly like the authorization helpers you are looking for,
which is the trap. They compile to SQL that never runs for a request. Calling one
from application code produces a check that always passes.

An access check written against RLS is therefore not an access check. The single
authorization mechanism that runs is the role table in
`app/lib/domain/dashboard/dashboard-operations.ts`.

Server side, resolve the actor and assert:

```ts
const membership = await resolveSceneMembership(user.id, sceneId)  // .server.ts
assertDashboardPermission('scene:delete', membership)
```

`resolveProjectMembership`, `resolveSceneMembership` and
`resolveSceneFolderMembership` live in `dashboard-permissions.server.ts`
alongside `assertDashboardPermission`.

Client side, `dashboard-operations.ts` is pure and client-safe, so components
call `canPerformDashboardOperation` directly to gate affordances. Loaders ship a
`DashboardCapabilityMap` built by `buildDashboardCapabilities`
(`dashboard-capabilities.ts`).

Adding an operation means adding it to the `DashboardOperation` union **and** to
`DASHBOARD_OPERATION_ROLES`. That map is a total `Record`, so a missing rule is a
compile error rather than a silent allow. Never hand-roll a role comparison.

**Report a non-member as 404, not 403,** on anything keyed by an id the actor
may not know. A 403 confirms the id exists, which turns the endpoint into an id
oracle. This is not yet uniform in the repo: `ApiResponse.forbidden` has 16 call
sites, correctly for CSRF and cross-origin rejection (which reveal no id) and
questionably on a few scene routes. Follow the rule on new code; do not copy the
nearest existing example.

## Non-negotiables

1. Server-only modules end in `.server.ts` and are never imported from a client
   component, a shared hook, or anything that reaches the browser bundle.
2. Drizzle queries live in repository modules. Cross-repository workflows live
   in services. Route modules stay thin: parse, authorize, call, respond.
3. Route composition follows access and layout boundaries first, file
   convenience second. Routes are declared in `app/routes.tsx`, not file-based.
4. Plan, entitlement, billing-state and consent identifiers come from
   `app/constants/plan-config.ts` (consent: `app/lib/consent/consent-cookie.ts`).
   Add to the owning type first so every missing case fails to compile.
5. Run every task through `pnpm nx`. Never call `eslint`, `tsc` or `vitest`
   directly.
6. Migrations come only from `pnpm nx run vectreal-platform:drizzle-generate`
   after a schema edit. Hand-authoring one desynchronizes the meta snapshot.

## Framework-mode traps that have cost real time here

**`fetcher.state === 'idle'` does not mean "finished".** It is also the state
before any request is dispatched. If dispatch happens in an effect, it never runs
during SSR, so a `loading` flag derived from `state` is false in the server HTML
and any "no results" branch behind it gets baked into the response. Derive
loaded-ness from the data instead:

```ts
const hasLoaded = fetcher.data !== undefined
```

This shipped three separate symptom fixes before the cause was found. When you
patch the same defect at a third call site, stop and find the cause.

**StrictMode double-invokes mount effects**, not update effects. A ref guard
around a load-once or submit-once effect exists for that reason alone. Say so in
a comment, or the next reader deletes it.

**A route module cannot be imported by a test.** `getDbClient()` runs at module
scope and throws `Missing DATABASE_URL`. Put logic a test needs to reach in a
pure module with no db import and no `.server` suffix, and have the route call
it. `app/lib/domain/scene/scene-route-params.ts` is the pattern.

## Recipe: a new resource route

1. Register it in `app/routes.tsx` under the API block:
   `route('api/projects/:projectId/api-keys', './routes/api/projects.$projectId.api-keys.ts')`
2. Loader: `getAuthUser` or `loadAuthenticatedUser` → `resolveProjectMembership`
   → `canPerformDashboardOperation` / `assertDashboardPermission`.
3. Action: `ensureValidCsrfFormData` (`app/lib/http/csrf.server.ts`) before any
   mutation.
4. Respond through `ApiResponse.*` from `@shared/utils`. The envelope is
   `{ success: true, data }` or `{ success: false, error, quota? }`.
5. Merge auth headers with `append`, not `set`. Supabase can rotate more than one
   cookie in a single response and `set` drops all but the last.

## Recipe: a dashboard mutation

Create, rename, move and delete for projects, folders and scenes already have a
home: `POST /api/dashboard/mutations`. The contract is in
`dashboard-mutations.ts`, execution in `dashboard-mutations.server.ts`, the
client hook is `useDashboardMutations`. The server recomputes the required tier
itself, so nothing client-supplied is trusted. Destructive confirmations come
from `planDeleteConfirmation` rendered by `ConfirmDestructiveDialog`.

Do not add a parallel endpoint for a fifth verb on these entities. Extend the
contract.

## Project manifests

Every project's `package.json` must declare what its own source imports, at the
installed version. pnpm resolves an undeclared import by walking up to the root
`node_modules`, so a wrong manifest still builds, which is how `@vctrl/core` came
to publish `three@^0.177.0` while the repo built against 0.185.1.

`@nx/dependency-checks` enforces this and `--fix` writes the correction,
including `catalog:`. Trust it over hand-editing. A package that deliberately
bundles a dependency declares that as an `ignoredDependencies` entry in
`eslint.config.mts` with a reason.

## Anti-patterns

| Anti-pattern | Replacement |
| --- | --- |
| Access check that relies on RLS, `auth.uid()`, or a hand-written role comparison | `assertDashboardPermission` against the operation table |
| 403 for a resource the actor cannot see | 404, so ids cannot be enumerated |
| Drizzle query inside a route module | Repository function, called through a service when it spans repositories |
| Shared abstraction created for one current caller | Explicit local code until a second caller exists |
| `loading` derived from `fetcher.state` | `hasLoaded` derived from `fetcher.data !== undefined` |
| Logic a test needs, placed in a route or `.server.ts` module | Pure module with no db import |
| New endpoint for an entity `/api/dashboard/mutations` already owns | Extend the mutation contract |

## Gates

```bash
pnpm nx run-many --target=typecheck,lint -p vctrl/core,vctrl/hooks,vctrl/viewer,vectreal-platform
```

Unit tests: `npx vitest run --root .` (or `pnpm nx test vectreal-platform`).
Integration tests need `pnpm nx run vectreal-platform:supabase-start` first, then
`pnpm nx run vectreal-platform:test-integration`.

## Source of truth

- `CLAUDE.md`
- `apps/vectreal-platform/app/routes.tsx`
- `apps/vectreal-platform/app/lib/domain/dashboard/dashboard-operations.ts`
- `apps/vectreal-platform/app/lib/domain/dashboard/dashboard-permissions.server.ts`
- `apps/vectreal-platform/app/constants/plan-config.ts`
- `apps/vectreal-platform/app/db/client.ts` (read it before trusting any claim
  about RLS)

## Verified claims

Executed by `apps/vectreal-platform/tests/documented-claims.spec.ts` on every
CI run. If one fails, either the code moved and this skill is now lying, or the
invariant genuinely broke. Both need a human.

```claims
absent   apps/vectreal-platform/app/db/client.ts                                            set local role
present  apps/vectreal-platform/app/db/client.ts                                            Missing DATABASE_URL
present  apps/vectreal-platform/app/db/schema/rls.ts                                        isOrganizationMember
present  apps/vectreal-platform/app/db/schema/rls.ts                                        canAccessProject
present  apps/vectreal-platform/app/lib/domain/dashboard/dashboard-permissions.server.ts    assertDashboardPermission
present  apps/vectreal-platform/app/lib/domain/dashboard/dashboard-permissions.server.ts    resolveProjectMembership
present  apps/vectreal-platform/app/lib/domain/dashboard/dashboard-permissions.server.ts    resolveSceneMembership
present  apps/vectreal-platform/app/lib/domain/dashboard/dashboard-permissions.server.ts    resolveSceneFolderMembership
present  apps/vectreal-platform/app/lib/domain/dashboard/dashboard-operations.ts            canPerformDashboardOperation
present  apps/vectreal-platform/app/lib/domain/dashboard/dashboard-operations.ts            DASHBOARD_OPERATION_ROLES
present  apps/vectreal-platform/app/lib/domain/dashboard/dashboard-capabilities.ts          buildDashboardCapabilities
present  apps/vectreal-platform/app/lib/domain/dashboard/dashboard-capabilities.ts          DashboardCapabilityMap
present  apps/vectreal-platform/app/lib/http/csrf.server.ts                                 ensureValidCsrfFormData
present  shared/utils/src/lib/api.utils.ts                                                  success: true, data
exists   apps/vectreal-platform/app/lib/domain/scene/scene-route-params.ts
present  apps/vectreal-platform/app/routes.tsx                                              api/dashboard/mutations
present  eslint.config.mts                                                                  dependency-checks
```
