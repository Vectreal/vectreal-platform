# Base image with Node.js: the official node:22-alpine, mirrored into this
# organization's GHCR by .github/workflows/ci-mirror-node-image.yaml. The deploy
# pulls it with GITHUB_TOKEN. Anonymous pulls are metered per IP, which every
# GitHub runner shares, so other tenants used up the quota: Docker Hub and then
# ECR Public both failed staging deploys with a 429. Building locally needs
# `docker login ghcr.io` unless the package is public. No `# syntax=` line for
# the same reason: BuildKit's built-in frontend covers everything this file uses.
FROM ghcr.io/vectreal/node:22-alpine AS base
ARG PNPM_VERSION=10.28.0
WORKDIR /app
ENV PNPM_HOME=/usr/local/bin

# Workspace manifests: what both dependency installs below read
FROM base AS manifests
ARG PNPM_VERSION
WORKDIR /app

# Enable corepack and prepare pnpm, before the manifests so a manifest change
# does not download pnpm again
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/vectreal-platform/package.json ./apps/vectreal-platform/
COPY packages/core/package.json ./packages/core/
COPY packages/hooks/package.json ./packages/hooks/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/viewer/package.json ./packages/viewer/
COPY shared/components/package.json ./shared/components/
COPY shared/utils/package.json ./shared/utils/

# Every dependency, dev included: the build needs Vite, React Router's CLI and Nx
FROM manifests AS deps
RUN pnpm install --frozen-lockfile --prod=false

# Production dependencies only: what the runner ships. The server bundle
# resolves its imports from here at runtime; the build tooling never runs in
# the image after the build stage, so the runner does not carry it.
FROM manifests AS prod-deps
RUN pnpm install --frozen-lockfile --prod

# Build stage
FROM deps AS build
WORKDIR /app

ARG BUILD_CSRF_SECRET=build-only-csrf-secret
ARG BUILD_DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ARG BUILD_SUPABASE_URL=https://build.invalid
ARG BUILD_SUPABASE_KEY=build-only-supabase-key
ARG BUILD_STRIPE_SECRET_KEY=sk_test_build_only
ARG BUILD_VITE_PUBLIC_POSTHOG_TOKEN=
# The ingestion proxy, not the PostHog origin. Only reached when the workflow
# passes no value; the real one comes from the repo secret of the same name.
ARG BUILD_VITE_PUBLIC_POSTHOG_HOST=https://go.vectreal.com
ARG BUILD_VITE_PUBLIC_POSTHOG_UI_HOST=https://eu.posthog.com
# Unset in CI, so deployed images report. Pass false to build one locally that
# does not: the browser bundle bakes this in, see posthog-enabled.ts.
ARG BUILD_VITE_PUBLIC_POSTHOG_ENABLED=

ENV CSRF_SECRET=${BUILD_CSRF_SECRET}
ENV DATABASE_URL=${BUILD_DATABASE_URL}
ENV SUPABASE_URL=${BUILD_SUPABASE_URL}
ENV SUPABASE_KEY=${BUILD_SUPABASE_KEY}
ENV STRIPE_SECRET_KEY=${BUILD_STRIPE_SECRET_KEY}
ENV VITE_PUBLIC_POSTHOG_TOKEN=${BUILD_VITE_PUBLIC_POSTHOG_TOKEN}
ENV VITE_PUBLIC_POSTHOG_HOST=${BUILD_VITE_PUBLIC_POSTHOG_HOST}
ENV VITE_PUBLIC_POSTHOG_UI_HOST=${BUILD_VITE_PUBLIC_POSTHOG_UI_HOST}
ENV VITE_PUBLIC_POSTHOG_ENABLED=${BUILD_VITE_PUBLIC_POSTHOG_ENABLED}

# Copy source and build application artifacts inside Docker. The client bundle
# is built here rather than reused from CI because Vite bakes the PostHog build
# args above into it, and CI builds with placeholders. Not `build-ci`: its route
# budget is a property of the source, which CI - Quality already checked before
# any deploy. The newsroom chunk check stays, because it is about this build:
# server.mjs withholds a scheduled article by the chunk names this build emits.
COPY . .
RUN cd apps/vectreal-platform && \
    pnpm exec react-router build && \
    pnpm exec tsx scripts/check-news-body-chunks.ts

# Runner stage
FROM base AS runner
ARG PNPM_VERSION
ARG NODE_ENV=production
WORKDIR /app

ENV NODE_ENV=${NODE_ENV}
ENV PORT=8080
ENV NODE_OPTIONS="--heapsnapshot-near-heap-limit=2"

# Runtime secrets are injected by Fly.io. The authoritative list is the manifest
# at the top of terraform/scripts/setup-fly-secrets.sh, and is deliberately not
# repeated here: the copy that used to sit at this line named twelve while the
# manifest requires seventeen, and nothing compared the two.
#
# What this stage does NOT inherit is the point. `build` is `FROM deps` and
# `deps` is `FROM base`; `runner` is `FROM base` directly, so it is off that
# branch entirely and inherits none of build's ENV - neither the VITE_PUBLIC_*
# values Vite bakes into the client bundle nor the throwaway placeholders that
# keep server-module env validation from throwing mid-build.
#
# So a name that appears as a build ARG above is not thereby available to the
# running server: anything read from process.env at runtime has to be a Fly
# secret in its own right. VITE_PUBLIC_POSTHOG_TOKEN is both, for two unrelated
# reasons; the manifest explains what having only the build half cost.

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy runtime dependencies and application artifacts from build stages.
COPY --from=prod-deps --chown=nodejs:nodejs /app/node_modules ./node_modules
# The repo is a pnpm workspace, so a dependency declared by the app installs
# into the app's own node_modules rather than the root one.
COPY --from=prod-deps --chown=nodejs:nodejs /app/apps/vectreal-platform/node_modules ./apps/vectreal-platform/node_modules
COPY --from=prod-deps --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=build --chown=nodejs:nodejs /app/build/apps/vectreal-platform ./build/apps/vectreal-platform
COPY --chown=nodejs:nodejs apps/vectreal-platform/server.mjs ./apps/vectreal-platform/server.mjs
COPY --chown=nodejs:nodejs apps/vectreal-platform/server-app.mjs ./apps/vectreal-platform/server-app.mjs

# Every package the server bundle imports has to resolve from the production
# dependencies above. Mounted beside the build rather than copied, so the check
# resolves from the server's own directories and leaves nothing in the image.
RUN --mount=type=bind,source=apps/vectreal-platform/scripts/check-server-imports.mjs,target=/app/build/apps/vectreal-platform/check-server-imports.mjs \
    node /app/build/apps/vectreal-platform/check-server-imports.mjs

USER nodejs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# server.mjs resolves the build directory relative to its own location, so the
# working directory only needs to place it beside the repo root.
WORKDIR /app/apps/vectreal-platform
CMD ["node", "server.mjs"]
