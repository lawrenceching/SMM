# Builder stage - Build UI and CLI using Bun
FROM oven/bun:1.3.5 AS builder

WORKDIR /build

# Copy workspace files needed for building
COPY packages/core/ ./packages/core/
COPY apps/ui/ ./apps/ui/
COPY apps/cli/ ./apps/cli/

# Install dependencies for all modules
WORKDIR /build/packages/core
RUN bun install --frozen-lockfile

WORKDIR /build/apps/ui
RUN bun install --frozen-lockfile

WORKDIR /build/apps/cli
RUN bun install --frozen-lockfile

# Build UI
WORKDIR /build/apps/ui
RUN bun run build

# Build CLI (set NODE_ENV=production to prevent pino-pretty from being loaded)
WORKDIR /build/apps/cli
ENV NODE_ENV=production
RUN bun run build

# Verify the binary exists and check its properties
RUN ls -lah /build/apps/cli/dist/ && \
    test -f /build/apps/cli/dist/cli && \
    echo "✓ Binary exists" && \
    file /build/apps/cli/dist/cli && \
    ldd /build/apps/cli/dist/cli 2>/dev/null || echo "Binary is static or ldd not available"

# Final stage - Use Debian slim with tini for proper signal handling
# Bun's compiled executables are built against glibc from Debian/Ubuntu
# This ensures library compatibility (can't use Alpine/musl as Bun executables need glibc)
FROM debian:bookworm-slim

# Install tini (init system for proper signal handling) and ca-certificates
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    wget && \
    wget -O /usr/local/bin/tini https://github.com/krallin/tini/releases/download/v0.19.0/tini-amd64 && \
    chmod +x /usr/local/bin/tini && \
    apt-get purge -y wget && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# Copy CLI executable
COPY --from=builder /build/apps/cli/dist/cli /app/cli

# Ensure executable has proper permissions
RUN chmod +x /app/cli

# Copy UI static files
COPY --from=builder /build/apps/ui/dist/ /app/public/

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Expose port
EXPOSE 30000

# Use tini as entrypoint for proper signal handling (Ctrl+C support)
ENTRYPOINT ["/usr/local/bin/tini", "--"]
CMD ["/app/cli", "--staticDir", "/app/public", "--port", "30000"]

