FROM selenium/standalone-chrome:latest

USER root

# Install Node.js 22 + pnpm (pinned) + Bun
ARG PNPM_VERSION=10.29.3

RUN apt-get update && apt-get install -y curl gnupg ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && corepack enable \
    && corepack prepare pnpm@${PNPM_VERSION} --activate \
    && npm install -g bun \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Wdio config picks these up to skip auto-download and apply docker flags
ENV CHROME_BIN=/usr/bin/google-chrome \
    CHROMEDRIVER=/usr/bin/chromedriver \
    BUILD_ENV=docker

# Selenium's entrypoint starts a Grid server — dev container doesn't need it.
# Also ensures we run as root (selenium image defaults to 'seluser').
ENTRYPOINT []
CMD ["sleep", "infinity"]
