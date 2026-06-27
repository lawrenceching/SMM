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
COPY packages/core packages/core
COPY packages/core-routes packages/core-routes
COPY packages/tvdb4 packages/tvdb4
COPY apps/cli apps/cli
# apps/ui is not built, but pnpm-lock.yaml records its full dep list. The
# --frozen-lockfile check needs apps/ui/package.json on disk to match the lockfile.
COPY apps/ui/package.json apps/ui/package.json

# Stub package.json for unused workspace members (required by pnpm workspace resolution)
COPY ci/docker/pnpm-stubs/apps/ohos/package.json apps/ohos/package.json
COPY ci/docker/pnpm-stubs/apps/electron/package.json apps/electron/package.json
COPY ci/docker/pnpm-stubs/apps/e2e/package.json apps/e2e/package.json
COPY ci/docker/pnpm-stubs/apps/convex/package.json apps/convex/package.json
COPY ci/docker/pnpm-stubs/apps/docker/package.json apps/docker/package.json
COPY ci/docker/pnpm-stubs/packages/test/package.json packages/test/package.json
COPY ci/docker/pnpm-stubs/packages/electron-common/package.json packages/electron-common/package.json
COPY ci/docker/pnpm-stubs/packages/utils/package.json packages/utils/package.json

RUN pnpm install --frozen-lockfile --filter cli...
ENV NODE_ENV=production
RUN pnpm --filter cli build

# Stage 2: Output — only the CLI executable
FROM scratch
COPY --from=builder /build/apps/cli/dist/cli /app/cli
