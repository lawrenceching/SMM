# SMM VideoCaptioner binary image
# Build context: repository root (e.g. docker build -f apps/docker/videocaptioner.Dockerfile .)
#
# Downloads VideoCaptioner release from SMM GitHub Releases (tag videocaptioner-<version>).
# Output layout (scratch root → /app/resources/ via COPY --from in final image):
#   /bin/videocaptioner/{videocaptioner,...}
#
# Tag this image: smm-videocaptioner:latest

ARG VIDEOCAPTIONER_VERSION=1.0.1
ARG VIDEOCAPTIONER_RELEASES_REPO=lawrenceching/SMM

FROM alpine:3.20 AS builder

RUN apk add --no-cache curl tar

ARG VIDEOCAPTIONER_VERSION
ARG VIDEOCAPTIONER_RELEASES_REPO
ARG TARGETARCH

RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) VC_SUFFIX=linux-x64 ;; \
      arm64) VC_SUFFIX=linux-arm64 ;; \
      *) echo "Unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    url="https://github.com/${VIDEOCAPTIONER_RELEASES_REPO}/releases/download/videocaptioner-${VIDEOCAPTIONER_VERSION}/videocaptioner-${VIDEOCAPTIONER_VERSION}-${VC_SUFFIX}.tar.gz"; \
    curl -sSLf -o /tmp/vc.tar.gz "$url"; \
    tar -xf /tmp/vc.tar.gz -C /tmp; \
    mkdir -p /output/bin/videocaptioner; \
    cp -a /tmp/videocaptioner/. /output/bin/videocaptioner/; \
    chmod +x /output/bin/videocaptioner/videocaptioner 2>/dev/null || true

FROM scratch
COPY --from=builder /output /
