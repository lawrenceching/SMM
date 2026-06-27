# SMM yt-dlp binary image
# Build context: repository root (e.g. docker build -f apps/docker/ytdlp.Dockerfile .)
#
# Downloads yt-dlp from plugins.tar.gz.
# Output layout (scratch root → /app/resources/ via COPY --from in final image):
#   /bin/yt-dlp/yt-dlp
#
# Tag this image: smm-ytdlp:latest

ARG PLUGINS_VERSION=v1.0.0
ARG PLUGINS_REPO=lawrenceching/SMM

FROM alpine:3.20 AS builder

RUN apk add --no-cache curl tar

ARG PLUGINS_VERSION
ARG PLUGINS_REPO
ARG TARGETARCH

RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) YTDLP_SRC=yt-dlp_linux ;; \
      arm64) YTDLP_SRC=yt-dlp_linux_aarch64 ;; \
      *) echo "Unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    url="https://github.com/${PLUGINS_REPO}/releases/download/${PLUGINS_VERSION}/plugins.tar.gz"; \
    curl -sSLf -o /tmp/plugins.tar.gz "$url"; \
    tar -xf /tmp/plugins.tar.gz -C /tmp; \
    mkdir -p /output/bin/yt-dlp; \
    cp "/tmp/plugins/${YTDLP_SRC}" /output/bin/yt-dlp/yt-dlp; \
    chmod +x /output/bin/yt-dlp/yt-dlp

FROM scratch
COPY --from=builder /output /
