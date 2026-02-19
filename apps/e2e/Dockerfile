# E2E Test Docker Image
# 
# This Dockerfile creates an environment for running WebDriverIO + Chrome E2E tests.
# It installs Chrome browser and all necessary dependencies.
#
# Usage:
#   docker build -t smm-e2e:test -f apps/e2e/Dockerfile .
#   docker run --rm smm-e2e:test
#
# Or use docker-compose:
#   docker-compose -f apps/e2e/docker-compose.yml up

FROM node:22-bookworm

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=development
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install system dependencies including Chrome
RUN apt-get update && apt-get install -y \
    # Chrome dependencies
    wget \
    gnupg2 \
    ca-certificates \
    apt-transport-https \
    # Fonts for rendering (including CJK)
    fonts-noto-cjk \
    fonts-wqy-microhei \
    fonts-wqy-zenhei \
    # X11 libraries for Chrome
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    # Additional utilities
    curl \
    unzip \
    # Clean up
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome Stable
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] https://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

RUN npm install -g bun

# Set working directory
WORKDIR /app

COPY . .

RUN pnpm install
RUN pnpm run build 
RUN bash apps/e2e/bin/start_test.sh
