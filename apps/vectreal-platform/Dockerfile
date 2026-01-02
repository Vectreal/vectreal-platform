# syntax=docker/dockerfile:1

# Base image with Node.js
FROM node:22-alpine AS base
ARG PNPM_VERSION=10.27.0
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
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Copy source files
COPY nx.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY shared ./shared

# Build the application
RUN npx nx build vectreal-platform --prod

# Runner stage
FROM base AS runner
ARG PNPM_VERSION
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy package files first
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/apps/vectreal-platform/package.json ./apps/vectreal-platform/package.json

# Copy built application
COPY --from=builder /app/apps/vectreal-platform/build ./apps/vectreal-platform/build

# Enable corepack and install production dependencies
RUN corepack enable && \
    corepack prepare pnpm@${PNPM_VERSION} --activate && \
    pnpm install --prod --frozen-lockfile

EXPOSE 8080

# Start the application
CMD ["node", "--no-warnings", "./apps/vectreal-platform/build/server/index.js"]
