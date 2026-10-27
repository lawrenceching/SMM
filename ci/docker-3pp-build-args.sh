#!/usr/bin/env bash
# Emit docker --build-arg flags for a 3pp image, reading versions from root package.json.
#
# Usage:
#   docker buildx build $(bash ci/docker-3pp-build-args.sh ytdlp) -t smm-ytdlp:latest \
#     -f apps/docker/ytdlp.Dockerfile .
#
# Components: ffmpeg | ytdlp | videocaptioner | bgutil

set -euo pipefail

COMPONENT="${1:?component required (ffmpeg|ytdlp|videocaptioner|bgutil)}"
REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

read_3pp() {
  (cd "${REPO_ROOT}" && node -p "require('./package.json')['3pp']['${1}']")
}

case "${COMPONENT}" in
  ffmpeg)
    printf '%s\n' "--build-arg FFMPEG_VERSION=$(read_3pp ffmpeg_version)"
    ;;
  ytdlp)
    printf '%s\n' "--build-arg YTDLP_VERSION=$(read_3pp ytdlp_version)"
    ;;
  videocaptioner)
    UPSTREAM="$(read_3pp videocaptioner_upstream_version)"
    SMM_BUILD="$(read_3pp videocaptioner_smm_build_version)"
    RELEASES_REPO="$(read_3pp videocaptioner_releases_repo)"
    printf '%s\n' "--build-arg VIDEOCAPTIONER_ARTIFACT_VERSION=${UPSTREAM}_${SMM_BUILD}"
    printf '%s\n' "--build-arg VIDEOCAPTIONER_RELEASES_REPO=${RELEASES_REPO}"
    ;;
  bgutil)
    printf '%s\n' "--build-arg BGUTIL_VERSION=$(read_3pp bgutil_version)"
    printf '%s\n' "--build-arg NODE_VERSION=$(read_3pp node_version)"
    ;;
  *)
    echo "Unknown component: ${COMPONENT} (expected ffmpeg|ytdlp|videocaptioner|bgutil)" >&2
    exit 1
    ;;
esac
