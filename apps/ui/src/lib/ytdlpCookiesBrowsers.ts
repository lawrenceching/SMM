/** yt-dlp `--cookies-from-browser` profile names (lowercase). */
export const YTDLP_COOKIES_BROWSER_IDS = ["chrome", "edge", "firefox"] as const

export type YtdlpCookiesBrowserId = (typeof YTDLP_COOKIES_BROWSER_IDS)[number]

export const DEFAULT_YTDLP_COOKIES_BROWSER_ID: YtdlpCookiesBrowserId = "chrome"

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
