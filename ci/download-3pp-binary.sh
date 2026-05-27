#!/usr/bin/env bash
# Download plugins.tar.gz (ffmpeg, yt-dlp) and VideoCaptioner release archives;
# install into bin/ffmpeg, bin/yt-dlp, and bin/videocaptioner for Electron/Docker packaging.
# Requires: PLATFORM (linux|win|mac), ARCH (x64|arm64).
# Optional: PLUGINS_VERSION, PLUGINS_REPO, VIDEOCAPTIONER_VERSION, VIDEOCAPTIONER_REPO.

set -e

PLATFORM="${PLATFORM:?PLATFORM is required (linux|win|mac)}"
ARCH="${ARCH:?ARCH is required (x64|arm64)}"
PLUGINS_VERSION="${PLUGINS_VERSION:-v1.0.0}"
PLUGINS_REPO="${PLUGINS_REPO:-lawrenceching/SMM}"
VIDEOCAPTIONER_VERSION="${VIDEOCAPTIONER_VERSION:-1.0.0}"
VIDEOCAPTIONER_REPO="${VIDEOCAPTIONER_REPO:-lawrenceching/VideoCaptioner}"

BASE_URL="https://github.com/${PLUGINS_REPO}/releases/download/${PLUGINS_VERSION}"
PLUGINS_TAR_URL="${BASE_URL}/plugins.tar.gz"
VC_BASE_URL="https://github.com/${VIDEOCAPTIONER_REPO}/releases/download/${VIDEOCAPTIONER_VERSION}"

case "${PLATFORM}-${ARCH}" in
  linux-x64)
    FFMPEG_DIR="ffmpeg-linux64"
    YTDLP_SRC="yt-dlp_linux"
    EXE_SUFFIX=""
    VC_SUFFIX="linux-x64"
    ;;
  linux-arm64)
    FFMPEG_DIR="ffmpeg-linuxarm64"
    YTDLP_SRC="yt-dlp_linux_aarch64"
    EXE_SUFFIX=""
    VC_SUFFIX="linux-arm64"
    ;;
  win-x64)
    FFMPEG_DIR="ffmpeg-win64"
    YTDLP_SRC="yt-dlp_x86.exe"
    EXE_SUFFIX=".exe"
    VC_SUFFIX="win-x64"
    ;;
  win-arm64)
    FFMPEG_DIR="ffmpeg-winarm64"
    YTDLP_SRC="yt-dlp_arm64.exe"
    EXE_SUFFIX=".exe"
    VC_SUFFIX="win-arm64"
    ;;
  mac-arm64)
    FFMPEG_DIR="ffmpeg-macos"
    YTDLP_SRC="yt-dlp_macos"
    EXE_SUFFIX=""
    VC_SUFFIX="mac-arm64"
    ;;
  *)
    echo "Unsupported PLATFORM/ARCH: ${PLATFORM}-${ARCH}" >&2
    exit 1
    ;;
esac

VIDEOCAPTIONER_EXE="videocaptioner${EXE_SUFFIX}"
VIDEOCAPTIONER_TAR="videocaptioner-${VIDEOCAPTIONER_VERSION}-${VC_SUFFIX}.tar.gz"
VIDEOCAPTIONER_TAR_URL="${VC_BASE_URL}/${VIDEOCAPTIONER_TAR}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "${TMPDIR}"' EXIT

echo "Downloading ${PLUGINS_TAR_URL} ..."
if ! curl -sSLf -o "${TMPDIR}/plugins.tar.gz" "${PLUGINS_TAR_URL}"; then
  echo "Download failed." >&2
  exit 1
fi

echo "Extracting plugins.tar.gz ..."
tar -xf "${TMPDIR}/plugins.tar.gz" -C "${TMPDIR}"

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

echo "Downloading ${VIDEOCAPTIONER_TAR_URL} ..."
if ! curl -sSLf -o "${TMPDIR}/${VIDEOCAPTIONER_TAR}" "${VIDEOCAPTIONER_TAR_URL}"; then
  echo "VideoCaptioner download failed." >&2
  exit 1
fi

echo "Extracting ${VIDEOCAPTIONER_TAR} ..."
tar -xf "${TMPDIR}/${VIDEOCAPTIONER_TAR}" -C "${TMPDIR}"

VC_SRC="${TMPDIR}/videocaptioner"
if [ ! -d "${VC_SRC}" ]; then
  echo "Expected videocaptioner/ directory not found in archive." >&2
  exit 1
fi
if [ ! -f "${VC_SRC}/${VIDEOCAPTIONER_EXE}" ]; then
  echo "Expected VideoCaptioner executable not found: ${VC_SRC}/${VIDEOCAPTIONER_EXE}" >&2
  exit 1
fi

rm -rf bin/videocaptioner
mkdir -p bin/videocaptioner
cp -a "${VC_SRC}/." bin/videocaptioner/

if [ "${PLATFORM}" != "win" ]; then
  chmod +x "bin/videocaptioner/${VIDEOCAPTIONER_EXE}" 2>/dev/null || true
fi

VC_BIN="bin/videocaptioner/${VIDEOCAPTIONER_EXE}"
if [ ! -f "${VC_BIN}" ]; then
  echo "VideoCaptioner binary not found after copy: ${VC_BIN}" >&2
  exit 1
fi

echo "VideoCaptioner installed into bin/videocaptioner."

# --- QuickJS ---
QUICKJS_VERSION="2025-09-13"
QUICKJS_BASE_URL="https://bellard.org/quickjs/binary_releases"

case "${PLATFORM}-${ARCH}" in
  win-x64)
    QUICKJS_ZIP="quickjs-win-x86_64-${QUICKJS_VERSION}.zip"
    QUICKJS_DIR="quickjs-win-x86_64-${QUICKJS_VERSION}"
    QUICKJS_EXE="qjs.exe"
    ;;
  linux-x64)
    QUICKJS_ZIP="quickjs-linux-x86_64-${QUICKJS_VERSION}.zip"
    QUICKJS_DIR="quickjs-linux-x86_64-${QUICKJS_VERSION}"
    QUICKJS_EXE="qjs"
    ;;
  win-arm64|linux-arm64|mac-arm64)
    QUICKJS_ZIP="quickjs-cosmo-${QUICKJS_VERSION}.zip"
    QUICKJS_DIR="quickjs-cosmo-${QUICKJS_VERSION}"
    QUICKJS_EXE="qjs"
    ;;
  *)
    echo "QuickJS: unsupported PLATFORM/ARCH: ${PLATFORM}-${ARCH}" >&2
    exit 1
    ;;
esac

QUICKJS_ZIP_URL="${QUICKJS_BASE_URL}/${QUICKJS_ZIP}"

echo "Downloading ${QUICKJS_ZIP_URL} ..."
if ! curl -sSLf -o "${TMPDIR}/${QUICKJS_ZIP}" "${QUICKJS_ZIP_URL}"; then
  echo "QuickJS download failed." >&2
  exit 1
fi

echo "Extracting ${QUICKJS_ZIP} ..."
unzip -qo "${TMPDIR}/${QUICKJS_ZIP}" -d "${TMPDIR}/quickjs-extracted"

QUICKJS_SRC="${TMPDIR}/quickjs-extracted/${QUICKJS_DIR}"
if [ ! -d "${QUICKJS_SRC}" ]; then
  # Some QuickJS archives store files directly in the zip root (no top-level folder)
  QUICKJS_SRC="${TMPDIR}/quickjs-extracted"
fi

if [ ! -f "${QUICKJS_SRC}/${QUICKJS_EXE}" ]; then
  echo "Expected QuickJS binary not found: ${QUICKJS_SRC}/${QUICKJS_EXE}" >&2
  ls -la "${TMPDIR}/quickjs-extracted/" >&2
  exit 1
fi

rm -rf bin/quickjs
mkdir -p bin/quickjs
cp -a "${QUICKJS_SRC}/." bin/quickjs/

QUICKJS_BIN="bin/quickjs/${QUICKJS_EXE}"
if [ ! -f "${QUICKJS_BIN}" ]; then
  echo "QuickJS binary not found after copy: ${QUICKJS_BIN}" >&2
  exit 1
fi

if [ "${PLATFORM}" != "win" ]; then
  chmod +x "bin/quickjs/qjs" 2>/dev/null || true
fi

echo "QuickJS installed into bin/quickjs."
