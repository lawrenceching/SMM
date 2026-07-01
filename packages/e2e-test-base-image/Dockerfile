# SMM E2E Test Base Image
#
# Pre-installs the test infrastructure (Node.js, npm, pnpm, Bun, Chrome,
# ChromeDriver, CJK fonts, system deps) so downstream test Dockerfiles don't
# re-download these on every build.
#
# Build (from repo root):
#   docker build -t smm-e2e-base:latest \
#     -f packages/e2e-test-base-image/Dockerfile .
#
# Or from this directory:
#   docker build -t smm-e2e-base:latest .
#
# Versions can be overridden via --build-arg, e.g.:
#   docker build --build-arg PNPM_VERSION=10.30.0 \
#                --build-arg BUN_VERSION=1.3.0 \
#                -t smm-e2e-base:custom \
#                -f packages/e2e-test-base-image/Dockerfile .
#
# Use in a downstream Dockerfile:
#   FROM smm-e2e-base:latest

FROM node:22-bookworm

# Tool versions (override via --build-arg)
ARG PNPM_VERSION=10.29.3
ARG BUN_VERSION=latest

ENV DEBIAN_FRONTEND=noninteractive \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true

# System deps + Chrome + CJK fonts. Uses gpg keyrings (apt-key is deprecated
# in Debian 12+).
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        wget gnupg2 ca-certificates apt-transport-https curl unzip \
        # Used to parse the chrome-for-testing JSON to find the matching chromedriver
        python3 \
        # CJK fonts (matching CI workflow + legacy WQY fonts)
        fonts-noto-cjk fonts-wqy-microhei fonts-wqy-zenhei \
        # Chrome runtime deps
        libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
        libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
        libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2; \
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub \
        | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg; \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" \
        > /etc/apt/sources.list.d/google-chrome.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends google-chrome-stable; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*

# ChromeDriver matching the installed Chrome. The chrome-for-testing API
# returns the latest stable version; the apt google-chrome-stable package
# usually tracks the same release within a patch version.
RUN set -eux; \
    CHROMEDRIVER_VERSION=$(curl -fsSL \
        https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json \
        | python3 -c "import json,sys; print(json.load(sys.stdin)['channels']['Stable']['version'])"); \
    echo "Installing chromedriver: $CHROMEDRIVER_VERSION"; \
    curl -fsSL \
        "https://storage.googleapis.com/chrome-for-testing-public/${CHROMEDRIVER_VERSION}/linux64/chromedriver-linux64.zip" \
        -o /tmp/chromedriver.zip; \
    unzip /tmp/chromedriver.zip -d /opt; \
    mv /opt/chromedriver-linux64/chromedriver /usr/local/bin/chromedriver; \
    chmod +x /usr/local/bin/chromedriver; \
    rm -rf /tmp/chromedriver.zip /opt/chromedriver-linux64; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*

# pnpm (pinned via corepack to match packageManager) + Bun.
RUN corepack enable \
    && corepack prepare pnpm@${PNPM_VERSION} --activate \
    && npm install -g bun@${BUN_VERSION}

ENV CHROME_BIN=/usr/bin/google-chrome \
    CHROMEDRIVER=/usr/local/bin/chromedriver
