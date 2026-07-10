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
