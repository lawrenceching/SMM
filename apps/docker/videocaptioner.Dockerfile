# SMM VideoCaptioner binary image
# Build context: repository root (e.g. docker build -f apps/docker/videocaptioner.Dockerfile .)
#
# Downloads VideoCaptioner release from GitHub.
# Output layout (scratch root → /app/resources/ via COPY --from in final image):
#   /bin/videocaptioner/{videocaptioner,...}
#
# Tag this image: smm-videocaptioner:latest

ARG VIDEOCAPTIONER_VERSION=1.0.0
ARG VIDEOCAPTIONER_REPO=lawrenceching/VideoCaptioner

FROM alpine:3.20 AS builder

RUN apk add --no-cache curl tar

ARG VIDEOCAPTIONER_VERSION
ARG VIDEOCAPTIONER_REPO
ARG TARGETARCH

RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) VC_SUFFIX=linux-x64 ;; \
      arm64) VC_SUFFIX=linux-arm64 ;; \
      *) echo "Unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    url="https://github.com/${VIDEOCAPTIONER_REPO}/releases/download/${VIDEOCAPTIONER_VERSION}/videocaptioner-${VIDEOCAPTIONER_VERSION}-${VC_SUFFIX}.tar.gz"; \
    curl -sSLf -o /tmp/vc.tar.gz "$url"; \
    tar -xf /tmp/vc.tar.gz -C /tmp; \
    mkdir -p /output/bin/videocaptioner; \
    cp -a /tmp/videocaptioner/. /output/bin/videocaptioner/; \
    chmod +x /output/bin/videocaptioner/videocaptioner 2>/dev/null || true

FROM scratch
COPY --from=builder /output /
