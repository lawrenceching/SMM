export const YTDLP_COOKIES_FROM_BROWSER_NAMES = ["chrome", "edge", "firefox"] as const;
export type YtdlpCookiesFromBrowserName = (typeof YTDLP_COOKIES_FROM_BROWSER_NAMES)[number];

export function isYtdlpCookiesFromBrowserName(
  value: string,
): value is YtdlpCookiesFromBrowserName {
  return (YTDLP_COOKIES_FROM_BROWSER_NAMES as readonly string[]).includes(value);
}
