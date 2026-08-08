#!/usr/bin/env bash
# Emits Docker image coordinates as KEY=VALUE lines (for GITHUB_OUTPUT or env).
#
# cli/ui images are tagged by commit SHA (app code rebuilds every commit).
# The 3pp images (ffmpeg / yt-dlp / videocaptioner) are tagged by their own
# software version from the root package.json "3pp" field, so unchanged
# external binaries are never re-downloaded by CI.
#
# Required env: OWNER_LC (lowercased repo owner), SHA (commit sha).

set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

OWNER_LC="${OWNER_LC:?OWNER_LC is required}"
SHA="${SHA:?SHA is required}"
OWNER_LC="$(printf '%s' "${OWNER_LC}" | tr '[:upper:]' '[:lower:]')"

read_3pp() {
  (cd "${REPO_ROOT}" && node -p "require('./package.json')['3pp']['${1}']")
}

FFMPEG_VERSION="$(read_3pp ffmpeg_version)"
YTDLP_VERSION="$(read_3pp ytdlp_version)"
VIDEOCAPTIONER_VERSION="$(read_3pp videocaptioner_version)"

echo "owner_lc=${OWNER_LC}"
echo "sha=${SHA}"
echo "cli_image=ghcr.io/${OWNER_LC}/smm-cli-build:${SHA}"
echo "ui_image=ghcr.io/${OWNER_LC}/smm-ui-build:${SHA}"
echo "ffmpeg_image=ghcr.io/${OWNER_LC}/smm-ffmpeg:${FFMPEG_VERSION}"
echo "ytdlp_image=ghcr.io/${OWNER_LC}/smm-ytdlp:${YTDLP_VERSION}"
echo "videocaptioner_image=ghcr.io/${OWNER_LC}/smm-videocaptioner:${VIDEOCAPTIONER_VERSION}"
echo "ffmpeg_version=${FFMPEG_VERSION}"
echo "ytdlp_version=${YTDLP_VERSION}"
echo "videocaptioner_version=${VIDEOCAPTIONER_VERSION}"
