# SMM bgutil POT provider image
# Build context: repository root (e.g. docker build -f apps/docker/bgutil.Dockerfile .)
#
# Output layout (scratch root → /app/resources/ via COPY --from in final image):
#   /bin/yt-dlp/yt-dlp-plugins/bgutil-ytdlp-pot-provider.zip
#   /bin/node/node
#   /bin/bgutil-pot-provider/package.json
#   /bin/bgutil-pot-provider/build/main.js
#   /bin/bgutil-pot-provider/node_modules/
#
# Debian (glibc), not Alpine: the official Node binary and the canvas prebuild
# are glibc-linked. canvas is compiled for the image TARGETARCH.

ARG BGUTIL_VERSION=2.0.2
ARG NODE_VERSION=22.22.0

FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl xz-utils unzip git python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

ARG BGUTIL_VERSION
ARG NODE_VERSION
ARG TARGETARCH

RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) NODE_PLATFORM=linux-x64 ;; \
      arm64) NODE_PLATFORM=linux-arm64 ;; \
      *) echo "Unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    NODE_DIST="node-v${NODE_VERSION}-${NODE_PLATFORM}"; \
    curl -sSLf -o /tmp/node.tar.xz "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_DIST}.tar.xz"; \
    tar -xJf /tmp/node.tar.xz -C /tmp; \
    NODE_ROOT="/tmp/${NODE_DIST}"; \
    NODE_BIN="${NODE_ROOT}/bin/node"; \
    NPM_CLI="$(find "${NODE_ROOT}" -path '*/npm/bin/npm-cli.js' | head -n 1)"; \
    test -x "${NODE_BIN}"; \
    test -f "${NPM_CLI}"; \
    mkdir -p /output/bin/node /output/bin/yt-dlp/yt-dlp-plugins; \
    cp "${NODE_BIN}" /output/bin/node/node; \
    chmod +x /output/bin/node/node; \
    curl -sSLf -o /output/bin/yt-dlp/yt-dlp-plugins/bgutil-ytdlp-pot-provider.zip \
      "https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/download/${BGUTIL_VERSION}/bgutil-ytdlp-pot-provider.zip"; \
    git clone --depth 1 --branch "${BGUTIL_VERSION}" \
      https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /tmp/bgutil; \
    cd /tmp/bgutil/server; \
    "${NODE_BIN}" "${NPM_CLI}" ci; \
    "${NODE_BIN}" ./node_modules/typescript/bin/tsc -p tsconfig.json; \
    "${NODE_BIN}" "${NPM_CLI}" prune --omit=dev; \
    test -f build/main.js; \
    mkdir -p /output/bin/bgutil-pot-provider; \
    cp package.json /output/bin/bgutil-pot-provider/package.json; \
    cp -a build /output/bin/bgutil-pot-provider/build; \
    cp -a node_modules /output/bin/bgutil-pot-provider/node_modules; \
    rm -rf /output/bin/bgutil-pot-provider/node_modules/.cache; \
    rm -f /output/bin/bgutil-pot-provider/build/tsconfig.tsbuildinfo /output/bin/bgutil-pot-provider/build/*.map

FROM scratch
COPY --from=builder /output /
