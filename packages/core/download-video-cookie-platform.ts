/**
 * Display name for the download-video dialog cookies hint (Youtube / Bilibili).
 * Returns empty string when the URL host is not a supported platform.
 */
export function getDownloadVideoCookiePlatformDisplayName(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) {
    return ""
  }

  let hostname: string
  try {
    hostname = new URL(trimmed).hostname.toLowerCase()
  } catch {
    return ""
  }

  if (
    hostname === "youtube.com" ||
    hostname.endsWith(".youtube.com") ||
    hostname === "youtu.be"
  ) {
    return "Youtube"
  }

  if (
    hostname === "bilibili.com" ||
    hostname.endsWith(".bilibili.com") ||
    hostname === "b23.tv"
  ) {
    return "Bilibili"
  }

  return ""
}

export function isYoutubeDownloadUrl(url: string): boolean {
  return getDownloadVideoCookiePlatformDisplayName(url) === "Youtube"
}

export const DOWNLOAD_VIDEO_COOKIES_WIKI_URL =
  "https://github.com/lawrenceching/SMM/wiki/How-to-login(set-cookies)-before-downloading"
