# Vectreal Platform App

The main Vectreal Platform application — a full-stack React Router v7 app with SSR, Supabase auth, Drizzle ORM, and Google Cloud Storage.

> **Full documentation**: [vectreal.com/docs](https://vectreal.com/docs)

---

## Tech stack

| Layer       | Technology                                           |
| ----------- | ---------------------------------------------------- |
| Framework   | React Router v7 (framework mode, SSR)                |
| Auth        | Supabase Auth (email/password + Google/GitHub OAuth) |
| Database    | PostgreSQL via Supabase + Drizzle ORM                |
| Storage     | Google Cloud Storage (private buckets)               |
| 3D pipeline | `@vctrl/hooks` (browser) + `@vctrl/core` (server)    |
| UI          | Radix UI + Tailwind CSS v4 (`@shared/components`)    |
| Build       | Vite + Nx                                            |

---

## Local development

### Prerequisites

- Node.js 18+, pnpm 9+, Docker (for local Supabase)
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

| Variable                                | Description                                        |
| --------------------------------------- | -------------------------------------------------- |
| `SUPABASE_URL`                          | Supabase API URL (local: `http://localhost:54321`) |
| `SUPABASE_KEY`                          | Supabase anon key (from `supabase status`)         |
| `DATABASE_URL`                          | PostgreSQL connection string                       |
| `CSRF_SECRET`                           | Long random string for CSRF token signing          |
| `GOOGLE_CLOUD_STORAGE_CREDENTIALS_FILE` | Path to GCS service account JSON key               |
| `GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET`   | GCS bucket name for model assets                   |

---

## Key directories

```
app/
├── routes/                  # React Router routes (file-based config in routes.tsx)
│   ├── docs/                # MDX documentation pages
│   ├── dashboard-page/      # Authenticated dashboard
│   ├── publisher-page/      # 3D model publisher
│   ├── preview-page/        # Embeddable scene viewer
│   ├── onboarding-page/     # First-run onboarding wizard
│   ├── layouts/             # Layout wrappers (nav, dashboard, docs, signin, mdx)
│   └── api/                 # API routes (scenes, auth, optimize-textures)
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

See [`DB_MIGRATIONS.md`](DB_MIGRATIONS.md) for the full workflow.

---

## Available Nx targets

```bash
pnpm nx dev vectreal-platform                # Dev server (http://localhost:4200)
pnpm nx build vectreal-platform              # Production build
pnpm nx test vectreal-platform               # Unit tests
pnpm nx lint vectreal-platform               # ESLint
pnpm nx run vectreal-platform:drizzle-generate  # Generate DB migration SQL
pnpm nx run vectreal-platform:supabase-db-reset # Reset local DB
```

---

## Docker

See [`DOCKER.md`](DOCKER.md) for building and running the app in a container, environment variable requirements, and health check configuration.

---

## Deployment

Deployed to **Google Cloud Run** via Terraform and GitHub Actions.

| Workflow   | Trigger                    |
| ---------- | -------------------------- |
| Staging    | Push to `main`             |
| Production | Manual `workflow_dispatch` |

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
