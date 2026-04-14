# Vectreal Platform

[![Vectreal Platform Banner](https://storage.googleapis.com/documentation-assets/vectreal-core-banner.png)](https://vectreal.com)

_Deployment Actions_  
[![Staging Deployment](https://img.shields.io/github/actions/workflow/status/vectreal/vectreal-platform/cd-platform-staging.yaml?logo=github&label=Staging%20Deployment&color=fc6c18)](https://github.com/Vectreal/vectreal-platform/actions)
[![Production Deployment](https://img.shields.io/github/actions/workflow/status/vectreal/vectreal-platform/cd-platform-production.yaml?logo=github&label=Production%20Deployment&color=fc6c18)](https://github.com/Vectreal/vectreal-platform/actions)

_See the viewer_  
[![Storybook](https://img.shields.io/badge/Storybook-viewer-fc6c18?logo=storybook)](https://www.chromatic.com/library?appId=672b9522ee5bda25942a731c)

_NPM packages_  
[![NPM CORE](https://img.shields.io/npm/dm/%40vctrl%2Fcore?logo=npm&label=%40vctrl/core)](https://npmjs.com/package/@vctrl/core)
[![NPM Hooks](https://img.shields.io/npm/dm/%40vctrl%2Fhooks?logo=npm&label=%40vctrl/hooks)](https://npmjs.com/package/@vctrl/hooks)
[![NPM Viewer](https://img.shields.io/npm/dm/%40vctrl%2Fviewer?logo=npm&label=%40vctrl/viewer)](https://npmjs.com/package/@vctrl/viewer)

_Product Hunt_  
[![Featured on Product Hunt](https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1119194&theme=light&t=1776193236739)](https://www.producthunt.com/products/vectreal?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-vectreal-platform)

---

Vectreal is an open platform for preparing, managing, and publishing 3D content for the web.

This monorepo contains the full platform app, reusable React packages, shared libraries, and infrastructure code used to run Vectreal in production.

Built on [Three.js](https://github.com/mrdoob/three.js), [React Three Fiber](https://github.com/pmndrs/react-three-fiber), [glTF-Transform](https://gltf-transform.dev), [Supabase](https://supabase.com), and [Nx](https://nx.dev).

## Quick Links (External)

- [Documentation](https://vectreal.com/docs)
- [Getting Started](https://vectreal.com/docs/getting-started)
- [Open Publisher](https://vectreal.com/publisher)
- [Storybook](https://www.chromatic.com/library?appId=672b9522ee5bda25942a731c)
- [Discord community](https://discord.gg/A9a3nPkZw7)
- [Changelog](https://github.com/Vectreal/vectreal-platform/blob/main/CHANGELOG.md)

## What Is In This Repo

| Area             | Path                      | Purpose                                                                                 |
| ---------------- | ------------------------- | --------------------------------------------------------------------------------------- |
| Platform app     | `apps/vectreal-platform/` | Full-stack React Router v7 app with SSR, auth, dashboard, publisher, and preview routes |
| Viewer package   | `packages/viewer/`        | `@vctrl/viewer` React 3D viewer component                                               |
| Hooks package    | `packages/hooks/`         | `@vctrl/hooks` browser-side loading, optimization, and export hooks                     |
| Core package     | `packages/core/`          | `@vctrl/core` server-side model processing pipeline                                     |
| Shared libraries | `shared/`                 | Shared UI components and utilities                                                      |
| Infrastructure   | `terraform/`              | Google Cloud Run, CDN, IAM, and storage configuration                                   |

## Documentation Map

| Section                                                        | What you will find                                              |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| [Getting Started](https://vectreal.com/docs/getting-started)   | Local setup, prerequisites, and a first-model walkthrough       |
| [Guides](https://vectreal.com/docs/guides/upload)              | Upload, optimize, publish, and embed workflows                  |
| [Package Reference](https://vectreal.com/docs/packages/viewer) | API docs for `@vctrl/viewer`, `@vctrl/hooks`, and `@vctrl/core` |
| [Operations](https://vectreal.com/docs/operations/deployment)  | GCP deployment, Terraform, and CI/CD                            |
| [Contributing](https://vectreal.com/docs/contributing)         | Branching, commits, testing, and PR process                     |

## Workflows And Package Reference

Use these links to move between product workflows and the package APIs behind them.

| Workflow guide                                                           | Package reference                                                                                                    | Source README                                                                                                                                                                                                                |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Uploading Models](https://vectreal.com/docs/guides/upload)              | [@vctrl/hooks](https://vectreal.com/docs/packages/hooks)                                                             | [packages/hooks/README.md](https://github.com/Vectreal/vectreal-platform/blob/main/packages/hooks/README.md)                                                                                                                 |
| [Optimizing & Configuring](https://vectreal.com/docs/guides/optimize)    | [@vctrl/hooks](https://vectreal.com/docs/packages/hooks), [@vctrl/viewer](https://vectreal.com/docs/packages/viewer) | [packages/hooks/README.md](https://github.com/Vectreal/vectreal-platform/blob/main/packages/hooks/README.md), [packages/viewer/README.md](https://github.com/Vectreal/vectreal-platform/blob/main/packages/viewer/README.md) |
| [Publishing & Embedding](https://vectreal.com/docs/guides/publish-embed) | [@vctrl/viewer](https://vectreal.com/docs/packages/viewer), [@vctrl/core](https://vectreal.com/docs/packages/core)   | [packages/viewer/README.md](https://github.com/Vectreal/vectreal-platform/blob/main/packages/viewer/README.md), [packages/core/README.md](https://github.com/Vectreal/vectreal-platform/blob/main/packages/core/README.md)   |
| [Deployment](https://vectreal.com/docs/operations/deployment)            | [@vctrl/core](https://vectreal.com/docs/packages/core)                                                               | [app/routes/docs/operations/deployment.mdx](https://github.com/Vectreal/vectreal-platform/blob/main/apps/vectreal-platform/app/routes/docs/operations/deployment.mdx)                                                        |

## Local Development

The local setup below matches the platform documentation in [Installation](https://vectreal.com/docs/getting-started/installation).

### 1. Clone the repository

```bash
git clone https://github.com/Vectreal/vectreal-platform.git
cd vectreal-platform
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

```bash
cp .env.development.example .env.development
```

The main variables required for local development are:

| Variable                                | Description                                                  |
| --------------------------------------- | ------------------------------------------------------------ |
| `SUPABASE_URL`                          | Local Supabase API URL, usually `http://localhost:54321`     |
| `SUPABASE_KEY`                          | Supabase anon key from `supabase status`                     |
| `DATABASE_URL`                          | PostgreSQL connection string for the local Supabase database |
| `GOOGLE_CLOUD_STORAGE_CREDENTIALS_FILE` | Path to a GCS service account JSON key                       |
| `GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET`   | Bucket used for model assets                                 |

Google Cloud Storage is required for upload and asset-serving flows.

### 4. Start the local Supabase stack

```bash
pnpm supabase start
pnpm nx run vectreal-platform:supabase-db-reset
```

This starts local Postgres, Auth, Storage, and Studio, then applies the baseline schema.

### 5. Start the platform app

```bash
pnpm nx dev vectreal-platform
```

Open [http://localhost:4200](http://localhost:4200).

### 6. Verify the setup

1. Open the home page.
2. Create an account at `/sign-up`.
3. Complete onboarding and confirm you land in the dashboard.
4. Upload a model in the Publisher to verify the full asset pipeline.

## Your First Model

The documented end-to-end workflow is:

1. Open the Publisher at [https://vectreal.com/publisher](https://vectreal.com/publisher).
2. Upload a GLB, glTF bundle, OBJ, or USDZ model.
3. Adjust quality, lighting, and camera settings.
4. Save the scene to your account.
5. Publish it to generate a stable embed URL.
6. Copy the iframe snippet into your application.

Full walkthrough: [Your First Model](https://vectreal.com/docs/getting-started/first-model).

## Architecture Overview

The monorepo is organised into three layers:

```text
vectreal-platform/
├── apps/vectreal-platform/   # Full-stack React Router v7 app (this site)
├── packages/
│   ├── viewer/               # @vctrl/viewer — React 3D viewer component
│   ├── hooks/                # @vctrl/hooks — browser-side loading and optimisation hooks
│   └── core/                 # @vctrl/core — server-side model processing
├── shared/
│   ├── components/           # Shared Radix UI component library
│   └── utils/                # Shared utility functions
└── terraform/                # GCP infrastructure as code
```

The platform app uses:

- React Router v7 in framework mode with SSR
- Supabase for authentication and database
- Drizzle ORM for type-safe SQL access
- Google Cloud Storage for 3D asset storage
- `@vctrl/viewer` and `@vctrl/hooks` for the in-browser 3D pipeline

## Package Overview

| Package         | Description                                                      | Docs                                                     |
| --------------- | ---------------------------------------------------------------- | -------------------------------------------------------- |
| `@vctrl/viewer` | Ready-to-use React 3D viewer component                           | [Viewer docs](https://vectreal.com/docs/packages/viewer) |
| `@vctrl/hooks`  | Browser-side hooks for loading, optimizing, and exporting models | [Hooks docs](https://vectreal.com/docs/packages/hooks)   |
| `@vctrl/core`   | Node.js loading, optimization, and export utilities              | [Core docs](https://vectreal.com/docs/packages/core)     |

## Deployment

Vectreal is deployed on Google Cloud Run behind a global HTTPS load balancer with CDN. Infrastructure is managed in Terraform and deployments are automated with GitHub Actions.

First-time infrastructure setup:

```bash
cd terraform
./scripts/apply-infrastructure.sh
./scripts/setup-github-secrets.sh
```

Database migration flow:

```bash
pnpm nx run vectreal-platform:drizzle-generate
pnpm nx run vectreal-platform:supabase-db-push-staging
pnpm nx run vectreal-platform:supabase-db-push-prod
```

High-level deployment docs: [https://vectreal.com/docs/operations/deployment](https://vectreal.com/docs/operations/deployment)  
Canonical infrastructure details: [terraform/README.md](https://github.com/Vectreal/vectreal-platform/blob/main/terraform/README.md)

## Contributing

We welcome contributions across code, docs, fixes, and performance improvements.

- Start with [Contributing](https://vectreal.com/docs/contributing)
- Read [CONTRIBUTING.md](https://github.com/Vectreal/vectreal-platform/blob/main/CONTRIBUTING.md)
- Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
- Update docs whenever you change a public API, route, or environment variable

Useful development commands:

```bash
pnpm nx affected --target=lint
pnpm nx affected --target=test
pnpm nx test vectreal-platform
```

## Community

- Website: [https://vectreal.com](https://vectreal.com)
- Discord: [https://discord.gg/A9a3nPkZw7](https://discord.gg/A9a3nPkZw7)
- GitHub Discussions: [https://github.com/Vectreal/vectreal-platform/discussions](https://github.com/Vectreal/vectreal-platform/discussions)
- GitHub Issues: [https://github.com/Vectreal/vectreal-platform/issues](https://github.com/Vectreal/vectreal-platform/issues)
- X: [https://x.com/vectreal](https://x.com/vectreal)
- Email: [info@vectreal.com](mailto:info@vectreal.com)

## License

GNU Affero General Public License v3.0.

See [LICENSE.md](https://github.com/Vectreal/vectreal-platform/blob/main/LICENSE.md).
