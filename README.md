[![Vectreal Platform Banner](https://storage.googleapis.com/documentation-assets/vectreal-core-banner.png)](https://vectreal.com)

[![Deploy Platform to Cloud Run](https://img.shields.io/github/actions/workflow/status/vectreal/vectreal-platform/deploy-platform.yaml?logo=github&logoColor=%23fc6c18&label=Deploy%20Platform%20to%20Cloud%20Run&color=%23fc6c18)](https://github.com/Vectreal/vectreal-platform/actions)
[![Version and release packages to NPM](https://img.shields.io/github/actions/workflow/status/vectreal/vectreal-platform/version-release.yaml?logo=github&logoColor=%23fc6c18&label=Version%20and%20release%20packages%20to%20NPM&color=%23fc6c18)](https://github.com/Vectreal/vectreal-platform/actions)
[![Storybook vctrl/viewer](https://img.shields.io/badge/Storybook_vctrl/viewer-Docs-fc6c18?logo=storybook&logoColor=%23fc6c18)](https://main--672b9522ee5bda25942a731c.chromatic.com/?path=/docs/vectrealviewer--docs)
[![@vctrl/viewer | NPM Downloads](https://img.shields.io/npm/dm/%40vctrl%2Fviewer?logo=npm&logoColor=%23fc6c18&label=%40vctrl%2Fviewer%20%7C%20NPM%20Downloads&color=%23fc6c18)](https://npmjs.com/package/@vctrl/viewer)
[![@vctrl/hooks | NPM Downloads](https://img.shields.io/npm/dm/%40vctrl%2Fhooks?logo=npm&logoColor=%23fc6c18&label=%40vctrl%2Fhooks%20%7C%20NPM%20Downloads&color=%23fc6c18)](https://www.npmjs.com/package/@vctrl/hooks)

# Vectreal Platform

Vectreal is an open platform for preparing, managing, and publishing 3D content on the web. Upload a model, optimize it, and embed it — all from the browser.

This monorepo contains the full platform application, the open-source React packages that power it, and the Terraform infrastructure that runs it.

> Built on top of [Three.js](https://github.com/mrdoob/three.js), [React Three Fiber](https://github.com/pmndrs/react-three-fiber), and [glTF-Transform](https://gltf-transform.dev). Orchestrated with [Nx](https://nx.dev) and [pnpm workspaces](https://pnpm.io/workspaces).

## Table of Contents

- [Vectreal Platform](#vectreal-platform)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Project Structure](#project-structure)
  - [Applications](#applications)
  - [Packages](#packages)
  - [Shared Libraries](#shared-libraries)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Environment Setup](#environment-setup)
    - [Running the Platform](#running-the-platform)
  - [Deployment](#deployment)
  - [Documentation](#documentation)
  - [Contributing](#contributing)
  - [License](#license)
  - [Contact](#contact)

## Features

- **Publisher** — drag-and-drop 3D model upload with live preview, quality presets, and scene configuration
- **Dashboard** — project and scene management, versioning, and organization support
- **Embed** — publish scenes and generate responsive iframe snippets with preview API key gating
- **Open packages** — `@vctrl/viewer`, `@vctrl/hooks`, and `@vctrl/core` usable in any React or Node.js project
- Full TypeScript across every package and application
- SSR-ready with React Router v7 framework mode

## Project Structure

```
vectreal-platform/
├── apps/
│   └── vectreal-platform/   # Full-stack React Router v7 platform app
├── packages/
│   ├── hooks/                # @vctrl/hooks  — browser-side 3D loading/optimisation hooks
│   ├── viewer/               # @vctrl/viewer — React 3D viewer component
│   └── core/                 # @vctrl/core   — server-side model processing (Node.js)
├── shared/
│   ├── components/           # Shared Radix UI + Tailwind component library
│   └── utils/                # Shared utility functions
└── terraform/                # GCP infrastructure as code (Cloud Run, CDN, IAM)
```

## Applications

- **[vectreal-platform](apps/vectreal-platform/)** — The Vectreal Platform web app. React Router v7, Supabase auth, Drizzle ORM, Google Cloud Storage.

## Packages

- **[@vctrl/hooks](packages/hooks/)** — React hooks for loading (`use-load-model`), optimising (`use-optimize-model`), and exporting (`use-export-model`) 3D models in the browser.

- **[@vctrl/viewer](packages/viewer/)** — Ready-to-use React viewer component built on React Three Fiber. Accepts any Three.js `Object3D` and provides camera, controls, lighting, and grid configuration.

- **[@vctrl/core](packages/core/)** — Server-side 3D model processing with `ModelLoader`, `ModelOptimizer`, and `ModelExporter`. Designed for Node.js API routes and background jobs.

## Shared Libraries

- **[@shared/components](shared/components/)** — Radix UI + Tailwind component library shared across apps.
- **[@shared/utils](shared/utils/)** — Shared TypeScript utilities.

## Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 18 or later |
| pnpm | 9 or later |
| Docker | Latest (for local Supabase) |
| Supabase CLI | Latest |

### Installation

```bash
git clone https://github.com/Vectreal/vectreal-platform.git
cd vectreal-platform
pnpm install
```

### Environment Setup

```bash
cp .env.development.example .env.development
```

Edit `.env.development` with your Supabase and Google Cloud Storage credentials.  
See [`apps/vectreal-platform/README.md`](apps/vectreal-platform/README.md) for all required variables.

### Running the Platform

```bash
# Start local Supabase stack (requires Docker)
pnpm supabase start

# Apply database migrations
pnpm nx run vectreal-platform:supabase-db-reset

# Start the app
pnpm nx serve vectreal-platform
```

The app runs at [http://localhost:4200](http://localhost:4200).

To run or build any other project:

```bash
pnpm nx serve vctrl/viewer         # Storybook
pnpm nx build vctrl/hooks          # Build the hooks package
pnpm nx show project vectreal-platform --web   # Show all available tasks
```

## Deployment

The platform deploys to **Google Cloud Run** via Terraform and GitHub Actions.

```bash
# 1. Provision infrastructure (one-time)
cd terraform
./scripts/apply-infrastructure.sh

# 2. Push GitHub secrets
./scripts/setup-github-secrets.sh

# 3. Deploy to staging (automatic on push to main)
git push origin main

# 4. Deploy to production (manual)
gh workflow run "CD - Deploy Platform to Production"
```

See [`terraform/README.md`](terraform/README.md) for the full infrastructure reference.

## Documentation

Full documentation is available at **[vectreal.com/docs](https://vectreal.com/docs)**:

- [Getting Started](https://vectreal.com/docs/getting-started)
- [Guides](https://vectreal.com/docs/guides/upload)
- [Package Reference](https://vectreal.com/docs/packages/viewer)
- [Operations / Deployment](https://vectreal.com/docs/operations/deployment)
- [Contributing](https://vectreal.com/docs/contributing)

Every docs page has an **Edit on GitHub** link pointing directly to its source file.

## Contributing

We welcome contributions of all kinds. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

1. Fork and branch from `main`
2. Make your changes and write tests where applicable
3. Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
4. Open a pull request

[Join our Discord](https://discord.gg/A9a3nPkZw7) to discuss ideas or get help.

## License

GNU Affero General Public License v3.0 — see [LICENSE.md](LICENSE.md) for details.

## Contact

Website: [vectreal.com](https://vectreal.com)  
Discord: [discord.gg/A9a3nPkZw7](https://discord.gg/A9a3nPkZw7)  
X/Twitter: [@Vectreal](https://x.com/vectreal)  
Email: [info@vectreal.com](mailto:info@vectreal.com)

