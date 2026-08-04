import { isEmpty } from "es-toolkit/compat"
import type { MediaMetadata, UserConfig } from "@core/types"
import type { ReverseProxyCandidate } from "@/hooks/useReverseProxyBaseUrls"
import localStorages from "@/lib/localStorages"

export const MEDIA_DATABASE_DEFAULT_HOST = "mediadb.vercel.app"

export function normalizeUpstreamBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "")
}

export function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export function readDisabledDomains(): Set<string> {
  return localStorages.disabledDomains
}

export function isDomainDisabled(domain: string): boolean {
  return readDisabledDomains().has(domain)
}

export function isUpstreamDirectDisabled(upstreamBaseUrl: string): boolean {
  const host = hostnameFromUrl(upstreamBaseUrl)
  return host !== null && isDomainDisabled(host)
}

export function isCustomUpstream(
  upstreamBaseUrl: string,
  defaultUpstreamBaseUrl: string,
): boolean {
  return (
    normalizeUpstreamBaseUrl(upstreamBaseUrl) !==
    normalizeUpstreamBaseUrl(defaultUpstreamBaseUrl)
  )
}

export function filterProxiesByDisabledDomains(
  proxies: ReverseProxyCandidate[],
): ReverseProxyCandidate[] {
  const disabled = readDisabledDomains()
  if (disabled.size === 0) return proxies
  return proxies.filter((proxy) => {
    const host = hostnameFromUrl(proxy.url)
    return host === null || !disabled.has(host)
  })
}

export function shouldTryDirectUpstream(
  upstreamBaseUrl: string,
  defaultUpstreamBaseUrl: string,
): boolean {
  if (isCustomUpstream(upstreamBaseUrl, defaultUpstreamBaseUrl)) {
    return false
  }
  return !isUpstreamDirectDisabled(upstreamBaseUrl)
}

/**
 * Resolve the outbound HTTP proxy for a media database. Mirrors the rule in
 * `fetchTmdb` / `fetchTvdb`: the proxy only applies when the user configured
 * a custom host (non-empty, parseable) AND set an httpProxy. Otherwise the
 * default upstream (mediadb.vercel.app) is used directly.
 */
export function resolveMediaDatabaseHttpProxy(
  database: "TMDB" | "TVDB",
  userConfig: UserConfig,
): string | undefined {
  const cfg = database === "TMDB" ? userConfig.tmdb : userConfig.tvdb
  if (!cfg) return undefined
  if (isEmpty(cfg.host)) return undefined
  if (!URL.canParse(cfg.host!)) return undefined
  const proxy = cfg.httpProxy?.trim()
  return proxy || undefined
}

/**
 * Resolve the proxy for a scrape task from the media metadata's database.
 */
export function resolveScrapeHttpProxy(
  mediaMetadata: MediaMetadata,
  userConfig: UserConfig,
): string | undefined {
  const database =
    mediaMetadata.type === "tvshow-folder"
      ? mediaMetadata.tvShow?.database
      : mediaMetadata.type === "movie-folder"
        ? mediaMetadata.movie?.database
        : undefined
  if (!database) return undefined
  return resolveMediaDatabaseHttpProxy(database, userConfig)
}
