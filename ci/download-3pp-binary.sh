#!/usr/bin/env bash
# Download plugins.tar from SMM GitHub release and extract platform-specific
# ffmpeg/ffprobe and yt-dlp into bin/ffmpeg and bin/yt-dlp for Electron packaging.
# Requires: PLATFORM (linux|win|mac), ARCH (x64|arm64). Optional: PLUGINS_VERSION, PLUGINS_REPO.

set -e

PLATFORM="${PLATFORM:?PLATFORM is required (linux|win|mac)}"
ARCH="${ARCH:?ARCH is required (x64|arm64)}"
PLUGINS_VERSION="${PLUGINS_VERSION:-v1.0.0}"
PLUGINS_REPO="${PLUGINS_REPO:-lawrenceching/SMM}"

BASE_URL="https://github.com/${PLUGINS_REPO}/releases/download/${PLUGINS_VERSION}"
PLUGINS_TAR_URL="${BASE_URL}/plugins.tar"

case "${PLATFORM}-${ARCH}" in
  linux-x64)
    FFMPEG_DIR="ffmpeg-linux64"
    YTDLP_SRC="yt-dlp_linux"
    EXE_SUFFIX=""
    ;;
  linux-arm64)
    FFMPEG_DIR="ffmpeg-linuxarm64"
    YTDLP_SRC="yt-dlp_linux_aarch64"
    EXE_SUFFIX=""
    ;;
  win-x64)
    FFMPEG_DIR="ffmpeg-win64"
    YTDLP_SRC="yt-dlp_x86.exe"
    EXE_SUFFIX=".exe"
    ;;
  win-arm64)
    FFMPEG_DIR="ffmpeg-winarm64"
    YTDLP_SRC="yt-dlp_arm64.exe"
    EXE_SUFFIX=".exe"
    ;;
  mac-arm64)
    FFMPEG_DIR="ffmpeg-macos"
    YTDLP_SRC="yt-dlp_macos"
    EXE_SUFFIX=""
    ;;
  *)
    echo "Unsupported PLATFORM/ARCH: ${PLATFORM}-${ARCH}" >&2
    exit 1
    ;;
esac

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "${TMPDIR}"' EXIT

echo "Downloading ${PLUGINS_TAR_URL} ..."
if ! curl -sSLf -o "${TMPDIR}/plugins.tar" "${PLUGINS_TAR_URL}"; then
  echo "Download failed." >&2
  exit 1
fi

echo "Extracting plugins.tar ..."
tar -xf "${TMPDIR}/plugins.tar" -C "${TMPDIR}"

PLUGINS="${TMPDIR}/plugins"
if [ ! -d "${PLUGINS}" ]; then
  echo "Expected plugins/ directory not found in archive." >&2
  exit 1
fi

FFMPEG_SRC="${PLUGINS}/${FFMPEG_DIR}"
YTDLP_SRC_PATH="${PLUGINS}/${YTDLP_SRC}"

if [ ! -d "${FFMPEG_SRC}" ]; then
  echo "Expected ffmpeg dir not found: ${FFMPEG_SRC}" >&2
  exit 1
fi
if [ ! -f "${YTDLP_SRC_PATH}" ]; then
  echo "Expected yt-dlp file not found: ${YTDLP_SRC_PATH}" >&2
  exit 1
fi

mkdir -p bin/ffmpeg bin/yt-dlp

# Copy ffmpeg and ffprobe (skip ffplay)
for name in ffmpeg ffprobe; do
  src="${FFMPEG_SRC}/${name}${EXE_SUFFIX}"
  if [ -f "${src}" ]; then
    cp "${src}" "bin/ffmpeg/${name}${EXE_SUFFIX}"
  fi
done

FFMPEG_BIN="bin/ffmpeg/ffmpeg${EXE_SUFFIX}"
if [ ! -f "${FFMPEG_BIN}" ]; then
  echo "ffmpeg binary not found after copy: ${FFMPEG_BIN}" >&2
  exit 1
fi

# Copy yt-dlp to bin/yt-dlp/yt-dlp or bin/yt-dlp/yt-dlp.exe
if [ -n "${EXE_SUFFIX}" ]; then
  cp "${YTDLP_SRC_PATH}" "bin/yt-dlp/yt-dlp.exe"
else
  cp "${YTDLP_SRC_PATH}" "bin/yt-dlp/yt-dlp"
fi

if [ "${PLATFORM}" != "win" ]; then
  chmod +x bin/ffmpeg/ffmpeg bin/ffmpeg/ffprobe bin/yt-dlp/yt-dlp 2>/dev/null || true
fi

echo "Third-party binaries installed into bin/ffmpeg and bin/yt-dlp."
