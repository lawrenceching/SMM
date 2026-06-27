# SMM UI Build — intermediate image with Vite dist output
# Build context: repository root (e.g. docker build -f apps/docker/ui.Dockerfile .)
# This image is meant to be used as a base in multi-stage Docker builds.
# The final image is a scratch image containing only the Vite build output at /.

# Stage 1: Build UI
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.29.3 --activate

WORKDIR /build

# Copy workspace root configs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy source packages needed for ui build
COPY packages/core packages/core
COPY packages/tvdb4 packages/tvdb4
COPY apps/ui apps/ui

# Stub package.json for unused workspace members (required by pnpm workspace resolution)
COPY ci/docker/pnpm-stubs/apps/ohos/package.json apps/ohos/package.json
COPY ci/docker/pnpm-stubs/apps/electron/package.json apps/electron/package.json
COPY ci/docker/pnpm-stubs/apps/e2e/package.json apps/e2e/package.json
COPY ci/docker/pnpm-stubs/apps/convex/package.json apps/convex/package.json
COPY ci/docker/pnpm-stubs/apps/docker/package.json apps/docker/package.json
COPY ci/docker/pnpm-stubs/packages/test/package.json packages/test/package.json
COPY ci/docker/pnpm-stubs/packages/electron-common/package.json packages/electron-common/package.json
COPY ci/docker/pnpm-stubs/packages/utils/package.json packages/utils/package.json

RUN pnpm install --frozen-lockfile --filter ui...
ENV NODE_ENV=production
RUN pnpm --filter ui build

# Stage 2: Output — only the dist files at root
FROM scratch
COPY --from=builder /build/apps/ui/dist/ /
