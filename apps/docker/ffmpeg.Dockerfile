# SMM ffmpeg / quickjs binary image
# Build context: repository root (e.g. docker build -f apps/docker/ffmpeg.Dockerfile .)
#
# ffmpeg/ffprobe come directly from BtbN FFmpeg-Builds GitHub releases (static codec
# builds, dynamic glibc — compatible with the debian:bookworm-slim final image);
# quickjs is downloaded from bellard.org. No npm packages are involved.
# Output layout (scratch root → /app/resources/ via COPY --from in final image):
#   /bin/ffmpeg/{ffmpeg,ffprobe}
#   /bin/quickjs/{qjs,...}
#
# Tag this image: smm-ffmpeg:<version>  (version = 3pp.ffmpeg_version in root package.json)
#
# FFMPEG_VERSION must stay in sync with 3pp.ffmpeg_version in root package.json.

ARG FFMPEG_VERSION=8.1

FROM alpine:3.20 AS builder

RUN apk add --no-cache curl tar xz unzip

ARG FFMPEG_VERSION
ARG TARGETARCH

# --- ffmpeg / ffprobe from BtbN FFmpeg-Builds ---
# BtbN release archives contain bin/{ffmpeg,ffprobe} in a
# ffmpeg-n<version>-latest-<arch>-gpl-<version>/ top-level directory.
RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) BTBN_ARCH=linux64 ;; \
      arm64) BTBN_ARCH=linuxarm64 ;; \
      *) echo "Unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    FFMPEG_TAR="ffmpeg-n${FFMPEG_VERSION}-latest-${BTBN_ARCH}-gpl-${FFMPEG_VERSION}.tar.xz"; \
    url="https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/${FFMPEG_TAR}"; \
    curl -sSLf -o /tmp/ffmpeg.tar.xz "$url"; \
    tar -xJf /tmp/ffmpeg.tar.xz -C /tmp; \
    FFMPEG_DIR="/tmp/ffmpeg-n${FFMPEG_VERSION}-latest-${BTBN_ARCH}-gpl-${FFMPEG_VERSION}"; \
    mkdir -p /output/bin/ffmpeg; \
    cp "${FFMPEG_DIR}/bin/ffmpeg" /output/bin/ffmpeg/ffmpeg; \
    cp "${FFMPEG_DIR}/bin/ffprobe" /output/bin/ffmpeg/ffprobe; \
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
