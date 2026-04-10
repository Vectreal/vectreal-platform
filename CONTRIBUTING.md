# Contributing to Vectreal Platform

Thank you for your interest in contributing! This guide will get you from zero to an open PR in under 30 minutes.

***

## Prerequisites

| Tool         | Minimum version | Install                            |
| ------------ | --------------- | ---------------------------------- |
| Node.js      | >= 22.x (LTS)  | [nodejs.org](https://nodejs.org)   |
| pnpm         | >= 10.x        | `npm i -g pnpm`                    |
| Docker       | any recent      | [docker.com](https://docker.com)   |
| Supabase CLI | latest          | `npm i -g supabase`                |
| Git          | any recent      | [git-scm.com](https://git-scm.com) |

Optional but recommended: [Nx Console](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console) extension for VS Code.

***

## Quick Start (30 minutes or less)

```bash
# 1. Fork then clone your fork
git clone https://github.com/<your-username>/vectreal-platform.git
cd vectreal-platform

# 2. Install all workspace dependencies
pnpm install

# 3. Copy the environment template
cp .env.development.example .env.development
# Set at minimum: CSRF_SECRET (any long random string)
# SUPABASE_URL and SUPABASE_KEY will be filled after step 4

# 4. Start local Supabase (requires Docker)
pnpm supabase start
# Copy the printed anon key and API URL into .env.development

# 5. Apply DB migrations
pnpm nx run vectreal-platform:supabase-db-reset

# 6. Start the dev server
pnpm nx dev vectreal-platform
# Open http://localhost:4200
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for deeper setup, package workflows, and troubleshooting.

***

## Branching Strategy

| Branch                | Purpose                        |
| --------------------- | ------------------------------ |
| `main`                | Production-ready; auto-deploys |
| `feat/<description>`  | New features                   |
| `fix/<description>`   | Bug fixes                      |
| `chore/<description>` | Tooling/config                 |
| `docs/<description>`  | Docs only                      |

Branch from `main` and open your PR back to `main`.

***

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Release Please reads these to auto-generate changelogs.

```
<type>(<scope>): <short summary>
```

**Types:** `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`

**Scopes:** `viewer`, `hooks`, `core`, `platform`, `infra`, `docs`

Examples:

```
feat(viewer): add USDZ drag-and-drop support
fix(core): handle missing normals in OBJ exporter
docs: expand local setup guide
```

Breaking changes: add `!` after the type, e.g. `feat(hooks)!: rename useLoadModel return shape`.

***

## Making Changes

1. Create a branch from `main`.
2. Write code following existing patterns (Tailwind, Radix/Shadcn, Jotai).
3. Add or update tests:
   ```bash
   pnpm nx affected --target=test
   ```
4. Lint and type-check:
   ```bash
   pnpm nx affected --target=lint
   pnpm nx affected --target=typecheck
   ```
5. Update docs if you changed a public API, added env vars, or changed a route.

***

## Pull Requests

* Fill in the PR template completely.
* Link issues with `Closes #<number>` or `Fixes #<number>`.
* Keep PRs focused: one feature or fix per PR.
* All CI checks must pass before merge.

***

## Monorepo Commands

```bash
# Run a target on a specific project
pnpm nx run <project>:<target>

# Run on all affected projects
pnpm nx affected --target=<target>

# Explore available targets
pnpm nx show project <project-name> --web

# Clear Nx cache
pnpm nx reset
```

***

## Release Ownership and Version Policy

1. Release Please is the single source of truth for package versions, changelog entries, tags, and GitHub releases.
2. The canonical package version state is stored in `.release-please-manifest.json` and configured by `release-please-config.json`.
3. Nx is used to run build and publish targets only. Do not use `nx release` in this repository.
4. Internal dependencies between co-developed packages must use `workspace:*` unless there is a documented exception.
5. The app at `apps/vectreal-platform` uses `workspace:*` for `@vctrl/*` dependencies to stay lockstep with local package development.

***

## Editing Docs

Every page on [vectreal.com/docs](https://vectreal.com/docs) is an MDX file in `apps/vectreal-platform/app/routes/docs/`. Click **Edit on GitHub** on any docs page to jump directly to the source file.

To add a new docs page, see the instructions in [`apps/vectreal-platform/README.md`](apps/vectreal-platform/README.md#docs).

***

## Reporting Bugs

Use [GitHub Issues](https://github.com/Vectreal/vectreal-platform/issues/new/choose) and select the Bug Report template. Include: steps to reproduce, expected vs actual behavior, environment details, and any console output.

***

## License

By contributing, you agree your contributions are licensed under [AGPL-3.0](LICENSE.md). Open an issue before contributing if you have concerns about AGPL requirements.
