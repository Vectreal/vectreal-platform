# syntax=docker/dockerfile:1

# Base image with Node.js
FROM node:22-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/usr/local/bin

# Dependencies stage
FROM base AS deps
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
RUN corepack prepare pnpm@10.27.0 --activate && \
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
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy built application
COPY --from=builder /app/apps/vectreal-platform/build ./build
COPY --from=builder /app/apps/vectreal-platform/package.json ./package.json

# Install only production dependencies for the runner
RUN pnpm install --prod --frozen-lockfile || \
    (npm install --omit=dev @react-router/node@^7.6.3 @react-router/serve@^7.6.3 react@^19.0.0 react-dom@^19.0.0)

EXPOSE 8080

# Start the application
CMD ["node", "--no-warnings", "./build/server/index.js"]
