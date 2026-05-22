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
    tar \
    bash \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && wget -O /usr/local/bin/tini https://github.com/krallin/tini/releases/download/v0.19.0/tini-amd64 \
    && chmod +x /usr/local/bin/tini \
    && apt-get purge -y wget \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/apps/cli/dist/cli /app/cli
RUN chmod +x /app/cli

COPY --from=builder /build/apps/ui/dist/ /app/public/

# Bundled ffmpeg, yt-dlp, and VideoCaptioner (same layout as Electron extraResources)
COPY ci/download-3pp-binary.sh /build/ci/download-3pp-binary.sh
ARG TARGETARCH
RUN case "${TARGETARCH}" in \
      amd64) export PLATFORM=linux ARCH=x64 ;; \
      arm64) export PLATFORM=linux ARCH=arm64 ;; \
      *) echo "Unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac && \
    cd /build && bash ci/download-3pp-binary.sh && \
    mkdir -p /app/resources && mv bin /app/resources/

WORKDIR /app
ENV NODE_ENV=production
ENV SMM_RESOURCES_PATH=/app/resources
EXPOSE 30000

ENTRYPOINT ["/usr/local/bin/tini", "--"]
CMD ["/app/cli", "--staticDir", "/app/public", "--port", "30000"]
