#!/usr/bin/env bash
# Emits buildx platform list and whether to push lawrenceching/smm:latest.
#
# Required env: BUILD_ARM64_DOCKER_IMAGE (GitHub boolean string: true/false).
# Writes KEY=VALUE lines for GITHUB_OUTPUT.

set -euo pipefail

BUILD_ARM64="${BUILD_ARM64_DOCKER_IMAGE:-true}"

if [ "${BUILD_ARM64}" = "true" ]; then
  echo "platforms=linux/amd64,linux/arm64"
  echo "push_latest=true"
else
  echo "platforms=linux/amd64"
  echo "push_latest=false"
fi
