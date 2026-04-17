# Development Guide

This guide covers everything you need to develop, test, and build the Vectreal Platform locally.

---

## Prerequisites

| Tool         | Version    | Notes                             |
| ------------ | ---------- | --------------------------------- |
| Node.js      | >= 22.x    | Use nvm or fnm to manage versions |
| pnpm         | >= 10.x    | `npm i -g pnpm`                   |
| Docker       | any recent | Required for local Supabase       |
| Supabase CLI | latest     | `npm i -g supabase`               |

---

## First-Time Setup

### 1. Clone and install

```bash
git clone https://github.com/Vectreal/vectreal-platform.git
cd vectreal-platform
pnpm install
```

### 2. Environment configuration

```bash
cp .env.development.example .env.development
```

Open `.env.development` and configure:

**Required (minimum for local dev):**

| Variable       | How to get it                                                               |
| -------------- | --------------------------------------------------------------------------- |
| `SUPABASE_URL` | Printed by `pnpm supabase start` (API URL)                                  |
| `SUPABASE_KEY` | Printed by `pnpm supabase start` (anon key)                                 |
| `DATABASE_URL` | Auto-constructed: `postgresql://postgres:postgres@localhost:54322/postgres` |
| `CSRF_SECRET`  | Any long random string, e.g. `openssl rand -hex 32`                         |

**Optional (for full feature coverage):**

| Variable                                    | Purpose                                                |
| ------------------------------------------- | ------------------------------------------------------ |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth login                                     |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth login                                     |
| `STRIPE_SECRET_KEY`                         | Billing features                                       |
| `GOOGLE_CLOUD_STORAGE_*`                    | File upload/download (set to empty to disable locally) |

### 3. Start Supabase

```bash
pnpm supabase start
```

This starts a local Postgres + Supabase stack via Docker. After startup, copy the printed **API URL** and **anon key** into `.env.development`.

Access Supabase Studio at `http://localhost:54323`.

### 4. Apply migrations

```bash
pnpm nx run vectreal-platform:supabase-db-reset
```

This drops and re-creates the local database and applies all migrations from `apps/vectreal-platform/supabase/migrations/`.

### 5. Start the dev server

```bash
pnpm nx dev vectreal-platform
```

App is available at `http://localhost:4200` with HMR enabled.

---

## Common Commands

### Dev server

```bash
pnpm nx dev vectreal-platform           # Start app with HMR
pnpm nx run vectreal-platform:dev-react-compiler  # Experimental dev server with React Compiler enabled
pnpm nx build vectreal-platform         # Production build
pnpm nx typecheck vectreal-platform     # Type-check app only
```

`pnpm nx build vectreal-platform` and CI `build-ci` runs now enable React Compiler by default.
Use `pnpm nx run vectreal-platform:dev-react-compiler` to exercise compiler output locally without changing the default dev loop.

### Packages

```bash
pnpm nx build @vctrl/viewer             # Build viewer package
pnpm nx build @vctrl/hooks              # Build hooks package
pnpm nx build @vctrl/core               # Build core package
pnpm nx storybook @vctrl/viewer         # Run Storybook for viewer
```

### Testing

```bash
pnpm nx affected --target=test          # Test all affected projects
pnpm nx test vectreal-platform          # Test app only
pnpm nx test @vctrl/core                # Test core package only
pnpm nx e2e vectreal-platform-e2e       # Run Playwright E2E tests
```

### Code quality

```bash
pnpm nx affected --target=lint          # Lint affected projects
pnpm nx affected --target=typecheck     # Type-check affected projects
```

### Database

```bash
# Generate SQL migration from Drizzle schema changes
pnpm nx run vectreal-platform:drizzle-generate

# Reset local DB (drops + re-applies all migrations)
pnpm nx run vectreal-platform:supabase-db-reset

# Start/stop local Supabase
pnpm supabase start
pnpm supabase stop
```

### NX utilities

```bash
pnpm nx show project <name> --web       # Visual task graph for a project
pnpm nx graph                           # Full workspace dependency graph
pnpm nx reset                           # Clear Nx cache
pnpm nx affected --target=build --dry-run  # Preview what would run
```

---

## Repo Structure

```text
vectreal-platform/
├── apps/
│   └── vectreal-platform/    # Full-stack React Router v7 app
│       ├── app/
│       │   ├── routes/       # File-based routes (docs, dashboard, publisher, preview)
│       │   ├── components/   # UI components (Shadcn/Radix based)
│       │   ├── db/           # Drizzle ORM schemas + queries
│       │   └── hooks/        # App-level React hooks
│       ├── supabase/         # Migrations + config
│       └── Dockerfile
├── packages/
│   ├── core/                 # @vctrl/core — server-side 3D processing
│   ├── hooks/                # @vctrl/hooks — React hooks for 3D
│   └── viewer/               # @vctrl/viewer — React 3D viewer component
├── shared/                   # Shared UI components and utilities
├── terraform/                # GCP infrastructure (Cloud Run, GCS, CDN)
├── .github/workflows/        # CI/CD pipelines
└── prd/                      # Product requirements docs
```

---

## Working with Packages vs the App

The three `packages/` projects (`@vctrl/core`, `@vctrl/hooks`, `@vctrl/viewer`) are publishable npm packages. They are also consumed by the platform app.

- Changes to packages are picked up by the app automatically via pnpm workspace linking — no need to rebuild packages during local development.
- When building for release, Nx runs packages through Rollup before the app build.
- Run `pnpm nx storybook @vctrl/viewer` to develop viewer components in isolation.

---

## CI/CD Pipelines

| Workflow                      | Trigger         | What it does                           |
| ----------------------------- | --------------- | -------------------------------------- |
| `ci-quality.yaml`             | Every PR + push | Lint + typecheck + test                |
| `cd-packages-release.yaml`    | Push to `main`  | Release Please changelog + npm publish |
| `cd-platform-staging.yaml`    | Push to `main`  | Deploy to staging Cloud Run            |
| `cd-platform-production.yaml` | Release tag     | Deploy to production Cloud Run         |
| `cd-chromatic-viewer.yaml`    | Push            | Visual regression via Chromatic        |

All PRs must pass `ci-quality.yaml` before merge.

---

## Troubleshooting

**`pnpm supabase start` hangs or fails**

- Ensure Docker Desktop is running.
- Try `pnpm supabase stop --no-backup` then restart.

**Port 4200 already in use**

- Change `VITE_DEV_PORT` in `.env.development`.

**`supabase-db-reset` fails with connection error**

- Confirm Supabase is running: `pnpm supabase status`.
- Check `DATABASE_URL` in `.env.development` matches the port printed by `supabase status`.

**Nx cache gives stale results**

- Run `pnpm nx reset` to clear the cache.

**TypeScript errors after pulling latest changes**

- Run `pnpm install` — a new package may have been added.
- Then `pnpm nx reset` if errors persist.
