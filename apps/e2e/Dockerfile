# E2E Test Docker Image
#
# Linux container for running apps/e2e WebdriverIO tests.
#
# Depends on the base image built from packages/e2e-test-base-image/:
#   docker build -t smm-e2e-base:latest \
#     -f packages/e2e-test-base-image/Dockerfile .
#
# Usage:
#   docker build -t smm-e2e:test -f apps/e2e/Dockerfile .
#   docker run --rm smm-e2e:test                          # default: runs hello.e2e.ts
#   docker run --rm smm-e2e:test pnpm run wdio:tv         # run tv group
#
# Requires .dockerignore to allow apps/e2e/ and packages/test/
# (add `!apps/e2e/` and `!packages/test/` lines).

FROM smm-e2e-base:latest

ENV BUILD_ENV=docker

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/e2e

# Default smoke-test for the environment. Override with
# `docker run --rm <image> pnpm run wdio:<group>` to run a different group.
CMD ["pnpm", "run", "wdio:hello"]
