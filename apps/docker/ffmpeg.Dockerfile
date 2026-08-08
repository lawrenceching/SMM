# SMM ffmpeg / quickjs binary image
# Build context: repository root (e.g. docker build -f apps/docker/ffmpeg.Dockerfile .)
#
# ffmpeg/ffprobe come from the ffmpeg-static npm packages (FFmpeg 6.1.1, per-TARGETARCH);
# quickjs is downloaded from bellard.org.
# Output layout (scratch root → /app/resources/ via COPY --from in final image):
#   /bin/ffmpeg/{ffmpeg,ffprobe,...}
#   /bin/quickjs/{qjs,...}
#
# Tag this image: smm-ffmpeg:<version>  (version = 3pp.ffmpeg_version in root package.json)
#
# FFMPEG_STATIC_VERSION must stay in sync with 3pp.ffmpeg_version in root package.json.

ARG FFMPEG_STATIC_VERSION=5.3.0

FROM node:22-bookworm-slim AS builder

WORKDIR /opt/ffmpeg-static

RUN apt-get update && apt-get install -y --no-install-recommends curl unzip && rm -rf /var/lib/apt/lists/*

ARG FFMPEG_STATIC_VERSION
ARG TARGETARCH

# --- ffmpeg / ffprobe from ffmpeg-static npm packages ---
# npm_config_arch forces the download to match TARGETARCH even when the builder
# stage runs on the build platform (no QEMU). ffmpeg-static supports linux x64/arm64.
RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) FFMPEG_ARCH=x64 ;; \
      arm64) FFMPEG_ARCH=arm64 ;; \
      *) echo "Unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    npm_config_arch="${FFMPEG_ARCH}" npm install --no-save \
      "ffmpeg-static@${FFMPEG_STATIC_VERSION}" \
      "@derhuerst/ffprobe-static@${FFMPEG_STATIC_VERSION}"; \
    mkdir -p /output/bin/ffmpeg; \
    cp node_modules/ffmpeg-static/ffmpeg /output/bin/ffmpeg/ffmpeg; \
    cp node_modules/@derhuerst/ffprobe-static/ffprobe /output/bin/ffmpeg/ffprobe; \
    chmod +x /output/bin/ffmpeg/ffmpeg /output/bin/ffmpeg/ffprobe

# --- QuickJS from bellard.org ---
RUN set -eux; \
    QUICKJS_VERSION="2025-09-13"; \
    case "${TARGETARCH}" in \
      amd64) \
        QUICKJS_ZIP="quickjs-linux-x86_64-${QUICKJS_VERSION}.zip"; \
        QUICKJS_DIR="quickjs-linux-x86_64-${QUICKJS_VERSION}"; \
        ;; \
      arm64) \
        QUICKJS_ZIP="quickjs-cosmo-${QUICKJS_VERSION}.zip"; \
        QUICKJS_DIR="quickjs-cosmo-${QUICKJS_VERSION}"; \
        ;; \
      *) echo "Unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    url="https://bellard.org/quickjs/binary_releases/${QUICKJS_ZIP}"; \
    curl -sSLf -o "/tmp/${QUICKJS_ZIP}" "$url"; \
    mkdir -p /tmp/quickjs-extracted; \
    unzip -qo "/tmp/${QUICKJS_ZIP}" -d /tmp/quickjs-extracted; \
    if [ -d "/tmp/quickjs-extracted/${QUICKJS_DIR}" ]; then \
      QJS_SRC="/tmp/quickjs-extracted/${QUICKJS_DIR}"; \
    else \
      QJS_SRC="/tmp/quickjs-extracted"; \
    fi; \
    mkdir -p /output/bin/quickjs; \
    cp -a "${QJS_SRC}/." /output/bin/quickjs/; \
    chmod +x /output/bin/quickjs/qjs 2>/dev/null || true

FROM scratch
COPY --from=builder /output /
