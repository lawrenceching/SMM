# SMM Docker image: CLI + UI (+ bin, see apps/docker/docs/development-plan.md)
# Build context: repository root (e.g. docker build -f apps/docker/Dockerfile .)

# Builder stage - Build UI and CLI using Node.js and pnpm
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN npm install -g bun

WORKDIR /build
COPY . .

RUN pnpm install --frozen-lockfile
ENV NODE_ENV=production
RUN pnpm run build

# Final stage
FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && wget -O /usr/local/bin/tini https://github.com/krallin/tini/releases/download/v0.19.0/tini-amd64 \
    && chmod +x /usr/local/bin/tini \
    && apt-get purge -y wget curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/apps/cli/dist/cli /app/cli
RUN chmod +x /app/cli

COPY --from=builder /build/apps/ui/dist/ /app/public/

# TODO(development-plan): Add /app/resources/bin (ffmpeg, yt-dlp) and set SMM_RESOURCES_PATH
# See apps/docker/docs/development-plan.md

WORKDIR /app
ENV NODE_ENV=production
EXPOSE 30000

ENTRYPOINT ["/usr/local/bin/tini", "--"]
CMD ["/app/cli", "--staticDir", "/app/public", "--port", "30000"]
