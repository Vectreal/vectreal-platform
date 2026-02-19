[![Vectreal Core Banner](https://storage.googleapis.com/documentation-assets/vectreal-core-banner.png)](https://core.vectreal.com)

[![Deploy apps/official-website to Google Cloud Run](https://img.shields.io/github/actions/workflow/status/vectreal/vectreal-core/deploy-official-website.yaml?logo=github&logoColor=%23fc6c18&label=Deploy%20apps%2Fofficial-website%20to%20Google%20Cloud%20Run&color=%23fc6c18)
](https://github.com/Vectreal/vectreal-core/actions/workflows/deploy-official-website.yaml)
[![Version and release packages to NPM](https://img.shields.io/github/actions/workflow/status/vectreal/vectreal-core/version-release.yaml?logo=github&logoColor=%23fc6c18&label=Version%20and%20release%20packages%20to%20NPM&color=%23fc6c18)
](https://github.com/Vectreal/vectreal-core/actions/workflows/version-release.yaml)
[![Storybook vctrl/viewer](https://img.shields.io/badge/Storybook_vctrl/viewer-Docs-fc6c18?logo=storybook&logoColor=%23fc6c18)](https://main--672b9522ee5bda25942a731c.chromatic.com/?path=/docs/vectrealviewer--docs)
[![@vctrl/viewer | NPM Downloads](https://img.shields.io/npm/dm/%40vctrl%2Fviewer?logo=npm&logoColor=%23fc6c18&label=%40vctrl%2Fviewer%20%7C%20NPM%20Downloads&color=%23fc6c18)](https://npmjs.com/package/@vctrl/viewer)
[![@vctrl/hooks | NPM Downloads](https://img.shields.io/npm/dm/%40vctrl%2Fhooks?logo=npm&logoColor=%23fc6c18&label=%40vctrl%2Fhooks%20%7C%20NPM%20Downloads&color=%23fc6c18)](https://www.npmjs.com/package/@vctrl/hooks)

# Vectreal Core

Vectreal Core is a robust, community-driven, open-source toolkit designed to seamlessly integrate high-performance 3D content into React-based projects. Our mission is to empower developers, designers, and creators with comprehensive resources to build stunning, interactive 3D experiences.

The monorepo is orchestrated using NX within an npm workspaces environment, primarily consisting of React.js projects.

> This project provides easy-to-use, fully configured components, hooks, and additional tools built on top of [Three.js](https://github.com/mrdoob/three.js) and [React Three Fiber](https://github.com/pmndrs/react-three-fiber).

## Table of Contents

- [Vectreal Core](#vectreal-core)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Project Structure](#project-structure)
  - [Packages](#packages)
    - [React Packages](#react-packages)
    - [Docker](#docker)
  - [Applications](#applications)
  - [Examples](#examples)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Environment Setup](#environment-setup)
    - [Running Projects](#running-projects)
  - [Deployment](#deployment)
  - [Contributing](#contributing)
  - [License](#license)
  - [Contact](#contact)

## Features

- Fully typed components for seamless integration with TypeScript projects
- Optimized performance for smooth 3D rendering
- Support for multiple 3D file formats (glTF, GLB, OBJ, USDZ, and more)
- Extensible architecture for custom implementations
- Comprehensive documentation and examples

## Project Structure

This monorepo is organized as follows:

```
vectreal-core/
├── packages/
│ ├── hooks/
│ └── viewer/
├── apps/
│ └── official-website/
├── docker/
├── examples/
└── docs/
```

## Packages

### React Packages

- **[@vctrl/hooks](https://github.com/Vectreal/vectreal-core/tree/main/packages/hooks)**: A collection of useful React hooks for loading and interacting with 3D files.
  - **use-load-model**: File or directory loading hooks for various approaches (Event based, React Context, direct)

  - **use-optimize-model**: Utilizing the [gltf-transform](https://gltf-transform.dev/) js library to optimize models in the browser. May be used standaloe or in conjunction with the `use-load-model` hook for convenience.

  - **use-export-model**: Export the scene in multiple formats using a minimal API

- **[@vctrl/viewer](https://github.com/Vectreal/vectreal-core/tree/main/packages/viewer)**: A fully type-safe and ready-to-use viewer component for React.

  Built with the `@vctrl/hooks/use-load-model` hook to dynamically load various model file types.

  Supported file formats:
  - glTF (with .bin and textures)
  - GLB
  - OBJ
  - USDZ (limited support, work in progress)

### Docker

- **[Docker images](https://github.com/Vectreal/vectreal-core/tree/main/packages/docker)**: (Work in Progress) Easily deploy convenient Vectreal tools like file converters in your Docker environment.

## Applications

- **[Official Website](https://github.com/Vectreal/vectreal-core/tree/main/apps/official-website)**: A showcase application built using the components and software provided in this monorepo. Deployed using GitHub Actions and Google Cloud.

## Examples

Visit our [free online editor toolkit](https://core.vectreal.com/editor) to see Vectreal Core in action. This interactive playground demonstrates the capabilities of our components and provides a hands-on experience for developers.

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm (v9 or later)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Vectreal/vectreal-core.git
   cd vectreal-core
   ```

   Install dependencies:

   ```bash
   npm install
   ```

### Environment Setup

Create a single local environment file at the repository root:

```bash
cp .env.development.example .env.development
```

Edit `.env.development` with your local development and deployment secret values.

### Running Projects

To serve one of the app projects, use the following command:

```bash
npx nx serve vctrl/official-website
```

To see all available targets for a project:

```bash
npx nx show project vctrl/official-website --web
```

> The optional `--web` parameter opens a visual overview of all possible commands available for a project.

For more information on working with NX, refer to the [official NX documentation](https://nx.dev/getting-started/tutorials/react-monorepo-tutorial#project-details-container).

## Deployment

The Vectreal Platform uses Infrastructure as Code (IaC) with Terraform for GCP deployment and GitHub Actions for CI/CD.

### Quick Deploy

```bash
# 1. Set up infrastructure (one-time)
cd terraform
./scripts/apply-infrastructure.sh

# 2. Configure GitHub secrets
./scripts/setup-github-secrets.sh

# 3. Deploy to staging
git push origin develop

# 4. Deploy to production
git push origin main
```

### Infrastructure

The infrastructure is managed with Terraform and includes:

- **Google Cloud Run** for containerized application hosting
- **Artifact Registry** for Docker image storage
- **Service Accounts** with least-privilege IAM roles
- **GitHub Secrets** for secure configuration management

Two setup scripts handle the deployment configuration:

- `scripts/apply-infrastructure.sh` - GCP authentication, Terraform initialization and deployment, service account key generation
- `scripts/setup-github-secrets.sh` - GitHub secrets configuration from `.env.development`

For detailed infrastructure setup, configuration options, and troubleshooting, see the [Terraform README](terraform/README.md).

### CI/CD Workflows

- **Staging Deployment**: Triggered on push to `develop` branch
- **Production Deployment**: Triggered on push to `main` branch
- **Package Release**: Triggered on version tags (`v*.*.*`)
- **Storybook Publishing**: Automated via Chromatic integration

All workflows use GitHub Actions and are configured to inject secrets at deployment time.

## Contributing

We welcome contributions from developers passionate about React and Three.js.

To contribute:

> Please read our Contributing Guidelines for more details.

1. Fork the repository
2. Create a new branch for your feature or bug fix
3. Make your changes and commit them following the commit message format described [here by NX](https://nx.dev/recipes/nx-release/get-started-with-nx-release)
4. Push your changes to your fork
5. Submit a pull request to the main repository

[Join our Discord community](https://discord.gg/A9a3nPkZw7) for support, announcements, and discussions about the future of 3D web content.

## License

GNU Affero General Public License

Please refer to the LICENSE file in the package root for licensing information.

## Contact

Website: [Vectreal Core](https://core.vectreal.com) | [Vectreal Platform](https://vectreal.com)

Discord: [Join our server](https://discord.gg/A9a3nPkZw7)

X/Twitter: [@Vectreal](https://x.com/vectreal)

Email: info@vectreal.com
