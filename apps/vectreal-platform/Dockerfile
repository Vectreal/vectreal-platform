# syntax=docker/dockerfile:1

# Base image with Node.js
FROM node:22-alpine AS base
ARG PNPM_VERSION=10.28.0
WORKDIR /app
ENV PNPM_HOME=/usr/local/bin

# Dependencies stage
FROM base AS deps
ARG PNPM_VERSION
WORKDIR /app

# Enable corepack and prepare pnpm
RUN corepack enable

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/vectreal-platform/package.json ./apps/vectreal-platform/
COPY packages/core/package.json ./packages/core/
COPY packages/hooks/package.json ./packages/hooks/
COPY packages/viewer/package.json ./packages/viewer/
COPY shared/components/package.json ./shared/components/
COPY shared/utils/package.json ./shared/utils/

# Install dependencies
RUN corepack prepare pnpm@${PNPM_VERSION} --activate && \
    pnpm install --frozen-lockfile --prod=false

# Runner stage
FROM base AS runner
ARG PNPM_VERSION
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV NODE_OPTIONS="--enable-source-maps --heapsnapshot-near-heap-limit=2"

# =============================================================================
# REQUIRED ENVIRONMENT VARIABLES (must be set at runtime):
# =============================================================================
# - DATABASE_URL: PostgreSQL connection string
# - SUPABASE_URL: Supabase project URL (e.g., https://xxx.supabase.co)
# - SUPABASE_KEY: Supabase anonymous/public key
# - GOOGLE_CLOUD_PROJECT: Google Cloud project ID (vectreal-platform)
# - GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET: Google Cloud Storage private bucket name
# - APPLICATION_URL: Application URL for OAuth redirects (optional)
# =============================================================================

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy runtime dependencies and prebuilt application artifacts.
# Build artifacts are produced in CI before docker build using:
#   pnpx nx build vectreal-platform
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/package.json ./package.json
COPY --chown=nodejs:nodejs build/apps/vectreal-platform ./build/apps/vectreal-platform

USER nodejs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application using react-router-serve from the correct directory
WORKDIR /app
CMD ["./node_modules/.bin/react-router-serve", "build/apps/vectreal-platform/server/index.js"]
