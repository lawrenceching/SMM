# SMM VideoCaptioner binary image
# Build context: repository root (e.g. docker build -f apps/docker/videocaptioner.Dockerfile .)
#
# Downloads VideoCaptioner release from SMM GitHub Releases
# (tag videocaptioner-<upstream>_<smm_build>).
# Output layout (scratch root → /app/resources/ via COPY --from in final image):
#   /bin/videocaptioner/{videocaptioner,...}
#
# Tag this image: smm-videocaptioner:<upstream>_<smm_build>
#
# Pass --build-arg VIDEOCAPTIONER_* from root package.json (see ci/docker-3pp-build-args.sh).
# ARG defaults below are only local fallbacks when build-args are omitted.

ARG VIDEOCAPTIONER_ARTIFACT_VERSION=1.4.2_1.0.2
ARG VIDEOCAPTIONER_RELEASES_REPO=lawrenceching/SMM

FROM alpine:3.20 AS builder

RUN apk add --no-cache curl tar

ARG VIDEOCAPTIONER_ARTIFACT_VERSION
ARG VIDEOCAPTIONER_RELEASES_REPO
ARG TARGETARCH

RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) VC_SUFFIX=linux-x64 ;; \
      arm64) VC_SUFFIX=linux-arm64 ;; \
      *) echo "Unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    url="https://github.com/${VIDEOCAPTIONER_RELEASES_REPO}/releases/download/videocaptioner-${VIDEOCAPTIONER_ARTIFACT_VERSION}/videocaptioner-${VIDEOCAPTIONER_ARTIFACT_VERSION}-${VC_SUFFIX}.tar.gz"; \
    curl -sSLf -o /tmp/vc.tar.gz "$url"; \
    tar -xf /tmp/vc.tar.gz -C /tmp; \
    mkdir -p /output/bin/videocaptioner; \
    cp -a /tmp/videocaptioner/. /output/bin/videocaptioner/; \
    chmod +x /output/bin/videocaptioner/videocaptioner 2>/dev/null || true

FROM scratch
COPY --from=builder /output /
