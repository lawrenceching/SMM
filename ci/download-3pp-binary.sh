#!/usr/bin/env bash
# ffmpeg/ffprobe, yt-dlp, VideoCaptioner, and QuickJS are downloaded directly from
# their official release sources — no npm packages, no self-hosted archive.
# Install into bin/ffmpeg, bin/yt-dlp, bin/videocaptioner, and bin/quickjs for Electron packaging.
# Requires: PLATFORM (linux|win|mac), ARCH (x64|arm64).
# Optional: FFMPEG_VERSION, YTDLP_VERSION, VIDEOCAPTIONER_VERSION, VIDEOCAPTIONER_REPO
# (ffmpeg/yt-dlp versions default to the `3pp` section of the root package.json).

set -e

PLATFORM="${PLATFORM:?PLATFORM is required (linux|win|mac)}"
ARCH="${ARCH:?ARCH is required (x64|arm64)}"
VIDEOCAPTIONER_VERSION="${VIDEOCAPTIONER_VERSION:-1.0.0}"
VIDEOCAPTIONER_REPO="${VIDEOCAPTIONER_REPO:-lawrenceching/VideoCaptioner}"

FFMPEG_VERSION="${FFMPEG_VERSION:-$(node -p "require('./package.json')['3pp'].ffmpeg_version" 2>/dev/null || echo 7.0.2)}"
YTDLP_VERSION="${YTDLP_VERSION:-$(node -p "require('./package.json')['3pp'].ytdlp_version" 2>/dev/null || echo 2026.07.04)}"
# osxexperts names its mac arm64 builds ffmpeg<VER>arm.zip (e.g. 81 = FFmpeg 8.1).
FFMPEG_MAC_VER="${FFMPEG_MAC_VER:-81}"

VC_BASE_URL="https://github.com/${VIDEOCAPTIONER_REPO}/releases/download/${VIDEOCAPTIONER_VERSION}"

case "${PLATFORM}-${ARCH}" in
  linux-x64)
    YTDLP_SRC="yt-dlp_linux"
    EXE_SUFFIX=""
    VC_SUFFIX="linux-x64"
    ;;
  linux-arm64)
    YTDLP_SRC="yt-dlp_linux_aarch64"
    EXE_SUFFIX=""
    VC_SUFFIX="linux-arm64"
    ;;
  win-x64)
    YTDLP_SRC="yt-dlp_x86.exe"
    EXE_SUFFIX=".exe"
    VC_SUFFIX="win-x64"
    ;;
  win-arm64)
    YTDLP_SRC="yt-dlp_arm64.exe"
    EXE_SUFFIX=".exe"
    VC_SUFFIX="win-arm64"
    ;;
  mac-arm64)
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

mkdir -p bin/ffmpeg bin/yt-dlp

# --- ffmpeg / ffprobe: direct download per platform ---
case "${PLATFORM}-${ARCH}" in
  linux-x64|linux-arm64)
    # johnvansickle.com static glibc builds; the tar contains ffmpeg + ffprobe
    if [ "${ARCH}" = "x64" ]; then FFMPEG_ARCH="amd64"; else FFMPEG_ARCH="arm64"; fi
    FFMPEG_TAR="ffmpeg-${FFMPEG_VERSION}-${FFMPEG_ARCH}-static.tar.xz"
    echo "Downloading ${FFMPEG_TAR} ..."
    curl -sSLf -o "${TMPDIR}/${FFMPEG_TAR}" "https://johnvansickle.com/ffmpeg/releases/${FFMPEG_TAR}"
    tar -xJf "${TMPDIR}/${FFMPEG_TAR}" -C "${TMPDIR}"
    FFMPEG_SRC="${TMPDIR}/ffmpeg-${FFMPEG_VERSION}-${FFMPEG_ARCH}-static/ffmpeg${EXE_SUFFIX}"
    FFPROBE_SRC="${TMPDIR}/ffmpeg-${FFMPEG_VERSION}-${FFMPEG_ARCH}-static/ffprobe${EXE_SUFFIX}"
    ;;
  win-x64|win-arm64)
    # BtbN FFmpeg-Builds (win64 / winarm64)
    if [ "${ARCH}" = "x64" ]; then BTBN_ARCH="win64"; else BTBN_ARCH="winarm64"; fi
    BTBN_ZIP="ffmpeg-n8.1-latest-${BTBN_ARCH}-gpl-8.1.zip"
    echo "Downloading ${BTBN_ZIP} ..."
    curl -sSLf -o "${TMPDIR}/btbn-ffmpeg.zip" "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/${BTBN_ZIP}"
    mkdir -p "${TMPDIR}/btbn-ffmpeg"
    unzip -qo "${TMPDIR}/btbn-ffmpeg.zip" -d "${TMPDIR}/btbn-ffmpeg"
    FFMPEG_SRC="$(find "${TMPDIR}/btbn-ffmpeg" -type f -name "ffmpeg${EXE_SUFFIX}" | head -n1)"
    FFPROBE_SRC="$(find "${TMPDIR}/btbn-ffmpeg" -type f -name "ffprobe${EXE_SUFFIX}" | head -n1)"
    ;;
  mac-arm64)
    # osxexperts.net static builds (darwin arm64)
    echo "Downloading osxexperts ffmpeg/ffprobe (${FFMPEG_MAC_VER}arm) ..."
    curl -sSLf -o "${TMPDIR}/ffmpeg-mac.zip" "https://www.osxexperts.net/ffmpeg${FFMPEG_MAC_VER}arm.zip"
    curl -sSLf -o "${TMPDIR}/ffprobe-mac.zip" "https://www.osxexperts.net/ffprobe${FFMPEG_MAC_VER}arm.zip"
    mkdir -p "${TMPDIR}/ffmpeg-mac"
    unzip -qo "${TMPDIR}/ffmpeg-mac.zip" -d "${TMPDIR}/ffmpeg-mac"
    unzip -qo "${TMPDIR}/ffprobe-mac.zip" -d "${TMPDIR}/ffmpeg-mac"
    FFMPEG_SRC="${TMPDIR}/ffmpeg-mac/ffmpeg${EXE_SUFFIX}"
    FFPROBE_SRC="${TMPDIR}/ffmpeg-mac/ffprobe${EXE_SUFFIX}"
    ;;
  *)
    echo "ffmpeg: unsupported PLATFORM/ARCH: ${PLATFORM}-${ARCH}" >&2
    exit 1
    ;;
esac

if [ ! -f "${FFMPEG_SRC}" ]; then
  echo "ffmpeg binary not found after download: ${FFMPEG_SRC}" >&2
  exit 1
fi
if [ ! -f "${FFPROBE_SRC}" ]; then
  echo "ffprobe binary not found after download: ${FFPROBE_SRC}" >&2
  exit 1
fi
cp "${FFMPEG_SRC}" "bin/ffmpeg/ffmpeg${EXE_SUFFIX}"
cp "${FFPROBE_SRC}" "bin/ffmpeg/ffprobe${EXE_SUFFIX}"

# --- yt-dlp: direct from official yt-dlp releases ---
echo "Downloading yt-dlp ${YTDLP_VERSION} (${YTDLP_SRC}) ..."
curl -sSLf -o "${TMPDIR}/${YTDLP_SRC}" "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/${YTDLP_SRC}"
if [ -n "${EXE_SUFFIX}" ]; then
  cp "${TMPDIR}/${YTDLP_SRC}" "bin/yt-dlp/yt-dlp.exe"
else
  cp "${TMPDIR}/${YTDLP_SRC}" "bin/yt-dlp/yt-dlp"
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
