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

# pnpm --frozen-lockfile tolerates missing workspace members: only packages
# present on disk are validated against pnpm-lock.yaml, so no stubs are needed
# for the other workspace projects.
RUN pnpm install --frozen-lockfile --filter ui...
ENV NODE_ENV=production
RUN pnpm --filter ui build

# Stage 2: Output — only the dist files at root
FROM scratch
COPY --from=builder /build/apps/ui/dist/ /
