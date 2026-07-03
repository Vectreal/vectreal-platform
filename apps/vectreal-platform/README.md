# Vectreal Platform App

The main Vectreal Platform application — a full-stack React Router v7 app with SSR, Supabase auth, Drizzle ORM, and Supabase Storage.

> **Full documentation**: [vectreal.com/docs](https://vectreal.com/docs)

---

## Tech stack

| Layer       | Technology                                           |
| ----------- | ---------------------------------------------------- |
| Framework   | React Router v7 (framework mode, SSR)                |
| Auth        | Supabase Auth (email/password + Google/GitHub OAuth) |
| Database    | PostgreSQL via Supabase + Drizzle ORM                |
| Storage     | Supabase Storage (`assets` bucket)                   |
| 3D pipeline | `@vctrl/hooks` (browser) + `@vctrl/core` (server)    |
| UI          | Radix UI + Tailwind CSS v4 (`@shared/components`)    |
| Build       | Vite + Nx                                            |

---

## Local development

### Prerequisites

- Node.js 21+, pnpm 10+, Docker (for local Supabase)
- Supabase CLI: `npm i -g supabase`

### Quick start

```bash
# 1. Install dependencies (from repo root)
pnpm install

# 2. Copy and configure environment
cp ../../.env.development.example ../../.env.development
# Edit .env.development — see "Environment variables" below

# 3. Start local Supabase
pnpm supabase start

# 4. Apply migrations
pnpm nx run vectreal-platform:supabase-db-reset

# 5. Start dev server
pnpm nx dev vectreal-platform
# → http://localhost:4200
```

### Environment variables

See [`../../.env.development.example`](../../.env.development.example) for the full list with comments.

**Required for core functionality:**

| Variable              | Description                                          |
| --------------------- | --------------------------------------------------- |
| `SUPABASE_URL`        | Supabase API URL (local: `http://localhost:54321`)  |
| `SUPABASE_KEY`        | Supabase anon key (from `supabase status`)          |
| `SUPABASE_SECRET_KEY` | Supabase service-role key, used server-side for the `assets` storage bucket |
| `DATABASE_URL`        | PostgreSQL connection string                        |
| `CSRF_SECRET`         | Long random string for CSRF token signing           |

---

## Key directories

```text
app/
├── routes/                  # React Router routes (file-based config in routes.tsx)
│   ├── docs/                # MDX documentation pages
│   ├── dashboard-page/      # Authenticated dashboard
│   ├── publisher-page/      # 3D model publisher
│   ├── preview-page/        # Embeddable scene viewer
│   ├── onboarding-page/     # First-run onboarding wizard
│   ├── layouts/             # Layout wrappers (nav, dashboard, docs, signin, mdx)
│   └── api/                 # Server-only API routes (auth, billing, scenes, consent, contact, theme)
├── components/              # UI components (publisher, dashboard, navigation, etc.)
├── lib/
│   ├── domain/              # Business logic by domain (auth, scene, project, user, ...)
│   ├── docs/                # Docs manifest for /docs routes + Edit on GitHub
│   ├── sessions/            # CSRF session handling
│   └── supabase.server.ts   # Supabase client factory
├── db/
│   ├── schema/              # Drizzle schema definitions
│   └── client.ts            # Drizzle DB client
└── styles/                  # CSS modules (global, MDX prose, etc.)
```

---

## Database migrations

This app uses a **Supabase-first migration flow** — Drizzle generates SQL, Supabase CLI applies it.

```bash
# Generate SQL from schema changes
pnpm nx run vectreal-platform:drizzle-generate

# Apply locally
pnpm nx run vectreal-platform:supabase-db-reset

# Apply to staging
pnpm nx run vectreal-platform:supabase-db-push-staging

# Apply to production
pnpm nx run vectreal-platform:supabase-db-push-prod
```

Drizzle schema modules live in `app/db/schema/`. Generate migrations from schema edits with `drizzle-generate`; never hand-author migration SQL.

---

## Available Nx targets

```bash
pnpm nx dev vectreal-platform                # Dev server (http://localhost:4200)
pnpm nx run vectreal-platform:dev-react-compiler # Experimental dev server with React Compiler enabled
pnpm nx build vectreal-platform              # Production build
pnpm nx test vectreal-platform               # Unit tests
pnpm nx lint vectreal-platform               # ESLint
pnpm nx run vectreal-platform:drizzle-generate  # Generate DB migration SQL
pnpm nx run vectreal-platform:supabase-db-reset # Reset local DB
```

React Compiler is enabled by default for app builds, including the CI `build-ci` target and Docker-based deploy builds.
The standard `dev` target remains unchanged; use `dev-react-compiler` when you want to validate compiler behavior locally.

---

## Docker

The platform app is containerised with a multi-stage [`Dockerfile`](Dockerfile). The same image is built in CI and deployed to Fly.io. Runtime config is provided through Fly.io app secrets; the container exposes a `/health` endpoint used by the deploy health check.

---

## Deployment

Deployed to **Fly.io** (region `fra`) via GitHub Actions. The workflow builds the Docker image, pushes it to GHCR and the Fly.io registry, then runs `flyctl deploy`.

| Workflow   | Fly app                     | Config             | Trigger                    |
| ---------- | --------------------------- | ------------------ | -------------------------- |
| Staging    | `vectreal-platform-staging` | `fly.staging.toml` | Push to `main`             |
| Production | `vectreal-platform`         | `fly.toml`         | Manual `workflow_dispatch` |

See the [Deployment docs](https://vectreal.com/docs/operations/deployment) or [`../../terraform/README.md`](../../terraform/README.md) for the full infrastructure reference.

---

## Onboarding

New users are redirected to `/onboarding` after their first sign-in. The onboarding wizard walks through:

1. Platform welcome + beta QA checklist
2. Uploading a model in the Publisher
3. Optimizing and configuring the scene
4. Managing scenes in the Dashboard
5. Publishing and embedding

---

## Docs

The `/docs` section of the app is built from MDX files in `app/routes/docs/`. Every page has an **Edit on GitHub** link generated from the docs manifest at `app/lib/docs/docs-manifest.ts`.

Cross-links between app guides and package references:

- [Uploading Models](https://vectreal.com/docs/guides/upload) <-> [@vctrl/hooks](https://vectreal.com/docs/packages/hooks)
- [Optimizing & Configuring](https://vectreal.com/docs/guides/optimize) <-> [@vctrl/hooks](https://vectreal.com/docs/packages/hooks), [@vctrl/viewer](https://vectreal.com/docs/packages/viewer)
- [Publishing & Embedding](https://vectreal.com/docs/guides/publish-embed) <-> [@vctrl/viewer](https://vectreal.com/docs/packages/viewer), [@vctrl/core](https://vectreal.com/docs/packages/core)

To add a new docs page:

1. Create an MDX file in `app/routes/docs/`.
2. Add an entry to `app/lib/docs/docs-manifest.ts`.
3. Register the route in `app/routes.tsx`.

---

## License

AGPL-3.0-only — see [`../../LICENSE.md`](../../LICENSE.md).
