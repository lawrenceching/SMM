import type { YtdlpCookiesBrowserId } from "./ytdlpCookiesBrowsers"

export interface CachedCookies {
  cookiesText: string
  useCookies: boolean
  useCookiesFromBrowser: boolean
  cookiesBrowser: YtdlpCookiesBrowserId
}

const cache = new Map<string, CachedCookies>()

export function getCachedCookies(hostname: string): CachedCookies | undefined {
  return cache.get(hostname)
}

export function setCachedCookies(hostname: string, entry: CachedCookies): void {
  if (!entry.useCookies && !entry.useCookiesFromBrowser) return
  cache.set(hostname, entry)
}

export function clearCookiesCache(): void {
  cache.clear()
}

export function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname || null
  } catch {
    return null
  }
}
