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
COPY packages/types packages/types
COPY packages/utils packages/utils
COPY packages/core-routes packages/core-routes
COPY packages/tvdb4 packages/tvdb4
# BrowserNetworkPort imports NetworkPort types from @smm/core (apps/core)
COPY apps/core apps/core
# UI maps @smm/server → apps/server/app.ts for Hono AppType (tsc -b during build)
COPY apps/server apps/server
COPY apps/ui apps/ui

# pnpm --frozen-lockfile tolerates missing workspace members: only packages
# present on disk are validated against pnpm-lock.yaml, so no stubs are needed
# for the other workspace projects.
# server... pulls AppType's type graph (@smm/core-routes, etc.). --ignore-scripts
# skips native builds (node-pty) that are unused for the UI static build.
RUN pnpm install --frozen-lockfile --filter ui... --filter server... --ignore-scripts
ENV NODE_ENV=production
RUN pnpm --filter ui build

# Stage 2: Output — only the dist files at root
FROM scratch
COPY --from=builder /build/apps/ui/dist/ /
