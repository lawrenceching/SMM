/** All yt-dlp `--cookies-from-browser` profile names (lowercase). */
export const YTDLP_COOKIES_BROWSER_IDS_ALL = ["chrome", "edge", "firefox"] as const

export type YtdlpCookiesBrowserId = (typeof YTDLP_COOKIES_BROWSER_IDS_ALL)[number]

/** @deprecated Use `getCookiesBrowserIds(platform)` for platform-aware filtering. */
export const YTDLP_COOKIES_BROWSER_IDS = YTDLP_COOKIES_BROWSER_IDS_ALL

/**
 * Returns available browsers for `--cookies-from-browser` on the given platform.
 * On Windows, Chrome and Edge are excluded because yt-dlp cannot decrypt their cookie stores.
 */
export function getCookiesBrowserIds(platform: string): readonly YtdlpCookiesBrowserId[] {
  if (platform === "win32") return ["firefox"]
  return YTDLP_COOKIES_BROWSER_IDS_ALL
}

export const DEFAULT_YTDLP_COOKIES_BROWSER_ID: YtdlpCookiesBrowserId = "firefox"

export type YtdlpCookiesBrowserLabelKey =
  | "downloadVideo.cookiesBrowserChrome"
  | "downloadVideo.cookiesBrowserEdge"
  | "downloadVideo.cookiesBrowserFirefox"

export function ytdlpCookiesBrowserLabelKey(id: YtdlpCookiesBrowserId): YtdlpCookiesBrowserLabelKey {
  switch (id) {
    case "chrome":
      return "downloadVideo.cookiesBrowserChrome"
    case "edge":
      return "downloadVideo.cookiesBrowserEdge"
    case "firefox":
      return "downloadVideo.cookiesBrowserFirefox"
  }
}
