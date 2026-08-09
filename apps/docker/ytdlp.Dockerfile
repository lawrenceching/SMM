# SMM yt-dlp binary image
# Build context: repository root (e.g. docker build -f apps/docker/ytdlp.Dockerfile .)
#
# Downloads yt-dlp from its official GitHub releases.
# Output layout (scratch root → /app/resources/ via COPY --from in final image):
#   /bin/yt-dlp/yt-dlp
#
# Tag this image: smm-ytdlp:<version>  (version = 3pp.ytdlp_version in root package.json)
#
# YTDLP_VERSION must stay in sync with 3pp.ytdlp_version in root package.json.

ARG YTDLP_VERSION=2026.07.04

FROM alpine:3.20 AS builder

RUN apk add --no-cache curl

ARG YTDLP_VERSION
ARG TARGETARCH

RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) YTDLP_SRC=yt-dlp_linux ;; \
      arm64) YTDLP_SRC=yt-dlp_linux_aarch64 ;; \
      *) echo "Unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    url="https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/${YTDLP_SRC}"; \
    mkdir -p /output/bin/yt-dlp; \
    curl -sSLf -o /output/bin/yt-dlp/yt-dlp "$url"; \
    chmod +x /output/bin/yt-dlp/yt-dlp

FROM scratch
COPY --from=builder /output /
