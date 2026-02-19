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

# Builder stage
FROM base AS builder
ARG PNPM_VERSION=10.28.0
WORKDIR /app

# Enable corepack and prepare pnpm
RUN corepack enable && \
    corepack prepare pnpm@${PNPM_VERSION} --activate

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Copy source files
COPY nx.json tsconfig.base.json eslint.config.mts ./
COPY apps ./apps
COPY packages ./packages
COPY shared ./shared

# Build the application
RUN pnpm exec nx build vectreal-platform

# Runner stage
FROM base AS runner
ARG PNPM_VERSION
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

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

# Copy built application and all dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/apps/vectreal-platform/build ./apps/vectreal-platform/build
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

USER nodejs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application using react-router-serve from the correct directory
WORKDIR /app/apps/vectreal-platform
CMD ["npx", "react-router-serve", "build/server/index.js"]
