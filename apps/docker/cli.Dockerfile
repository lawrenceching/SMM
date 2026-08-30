# SMM CLI Build — intermediate image with Linux single-file CLI executable
# Build context: repository root (e.g. docker build -f apps/docker/cli.Dockerfile .)
# This image is meant to be used as a base in multi-stage Docker builds.
# The final image is a scratch image containing only the CLI executable at /app/cli.

# Stage 1: Build CLI
FROM node:22-bookworm-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.29.3 --activate
# node-pty@1.1.0 falls back to node-gyp rebuild when prebuilt binaries are missing
# in the alpine prebuilds cache. Install build tools so the fallback succeeds.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install -g bun

WORKDIR /build

# Copy workspace root configs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy source packages needed for cli build
COPY packages/types packages/types
COPY packages/utils packages/utils
COPY packages/core-routes packages/core-routes
COPY packages/tvdb4 packages/tvdb4
# @smm/core (apps/core) is a runtime dependency of apps/cli (Core singleton)
COPY apps/core apps/core
COPY apps/cli apps/cli

# pnpm --frozen-lockfile tolerates missing workspace members: only packages
# present on disk are validated against pnpm-lock.yaml, so no stubs are needed
# for the other workspace projects.
RUN pnpm install --frozen-lockfile --filter cli...
ENV NODE_ENV=production
RUN pnpm --filter cli build

# Stage 2: Output — only the CLI executable
FROM scratch
COPY --from=builder /build/apps/cli/dist/cli /app/cli
