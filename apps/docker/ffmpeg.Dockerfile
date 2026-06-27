# SMM ffmpeg / quickjs binary image
# Build context: repository root (e.g. docker build -f apps/docker/ffmpeg.Dockerfile .)
#
# Downloads ffmpeg/ffprobe from plugins.tar.gz and quickjs from bellard.org.
# Output layout (scratch root → /app/resources/ via COPY --from in final image):
#   /bin/ffmpeg/{ffmpeg,ffprobe,...}
#   /bin/quickjs/{qjs,...}
#
# Tag this image: smm-ffmpeg:latest

ARG PLUGINS_VERSION=v1.0.0
ARG PLUGINS_REPO=lawrenceching/SMM

FROM alpine:3.20 AS builder

RUN apk add --no-cache curl tar unzip

ARG PLUGINS_VERSION
ARG PLUGINS_REPO
ARG TARGETARCH

# --- ffmpeg / ffprobe from plugins.tar.gz ---
RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) FFMPEG_DIR=ffmpeg-linux64 ;; \
      arm64) FFMPEG_DIR=ffmpeg-linuxarm64 ;; \
      *) echo "Unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    url="https://github.com/${PLUGINS_REPO}/releases/download/${PLUGINS_VERSION}/plugins.tar.gz"; \
    curl -sSLf -o /tmp/plugins.tar.gz "$url"; \
    tar -xf /tmp/plugins.tar.gz -C /tmp; \
    mkdir -p /output/bin/ffmpeg; \
    for name in ffmpeg ffprobe; do \
      src="/tmp/plugins/${FFMPEG_DIR}/${name}"; \
      if [ -f "$src" ]; then cp "$src" "/output/bin/ffmpeg/${name}"; fi; \
    done; \
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
