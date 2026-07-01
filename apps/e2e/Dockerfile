# E2E Test Docker Image
#
# Linux container for running apps/e2e WebdriverIO tests.
#
# Usage:
#   docker build -t smm-e2e:test -f apps/e2e/Dockerfile .
#   docker run --rm smm-e2e:test                          # default: runs hello.e2e.ts
#   docker run --rm smm-e2e:test pnpm run wdio:tv         # run tv group
#
# Requires .dockerignore to allow apps/e2e/ and packages/test/
# (add `!apps/e2e/` and `!packages/test/` lines).

FROM node:22-bookworm

ENV BUILD_ENV=docker \
    DEBIAN_FRONTEND=noninteractive \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true \
    CHROME_BIN=/usr/bin/google-chrome

# System deps, Chrome, and CJK fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
        wget gnupg2 ca-certificates apt-transport-https curl unzip \
        fonts-noto-cjk fonts-wqy-microhei fonts-wqy-zenhei \
        libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
        libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
        libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub \
        | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" \
        > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Pin pnpm to the version declared in packageManager
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/e2e

# Default smoke-test for the environment. Override with
# `docker run --rm <image> pnpm run wdio:<group>` to run a different group.
CMD ["pnpm", "run", "wdio:hello"]
