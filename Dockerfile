# Builder stage - Build UI and CLI using Node.js and pnpm
FROM node:22-alpine AS builder

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /build

# Copy workspace files needed for building
COPY . .

RUN pnpm install --frozen-lockfile
ENV NODE_ENV=production
RUN pnpm run build

# Final stage - Use Debian slim with tini for proper signal handling
# Use Node.js runtime for the built application
FROM debian:bookworm-slim

# Install Node.js runtime and tini (init system for proper signal handling)
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

# Copy CLI build output
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
