# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
ARG PNPM_VERSION=10.28.0
WORKDIR /app
ENV PNPM_HOME=/usr/local/bin

FROM base AS deps
ARG PNPM_VERSION
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json nx.json ./
COPY apps/trellis-runtime/tsconfig.json ./apps/trellis-runtime/tsconfig.json
RUN corepack prepare pnpm@${PNPM_VERSION} --activate && \
    pnpm install --frozen-lockfile --prod=false

FROM deps AS build
WORKDIR /app
COPY apps/trellis-runtime ./apps/trellis-runtime
RUN ./node_modules/.bin/tsc -p apps/trellis-runtime/tsconfig.json --outDir build/apps/trellis-runtime

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Runtime secrets are injected by Fly.io.
# Required: TRELLIS_RUNTIME_AUTH_SECRET
# Optional: TRELLIS_GENERATOR_COMMAND, TRELLIS_MOCK_ARTIFACT_SOURCE,
#           TRELLIS_MAX_CONCURRENT_JOBS, TRELLIS_MAX_IMAGE_BYTES,
#           TRELLIS_JOB_TTL_MS, TRELLIS_ARTIFACT_TTL_MS

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=build --chown=nodejs:nodejs /app/build/apps/trellis-runtime ./build/apps/trellis-runtime

USER nodejs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "build/apps/trellis-runtime/server.js"]

