import type { DiscoverConfig, MediaDatabaseType } from "@/api/discover"

export const TMDB_IMAGE_HOSTS = new Set(["image.tmdb.org"])
export const TVDB_ARTWORK_HOSTS = new Set(["artworks.thetvdb.com"])

function normalizeImageUrl(url: string): string {
  if (url.startsWith("//")) return `https:${url}`
  return url
}

function hostSwap(originalUrl: string, assetBaseUrl: string): string | null {
  try {
    const original = new URL(originalUrl)
    const base = new URL(assetBaseUrl)
    const swapped = new URL(original.href)
    swapped.protocol = base.protocol
    swapped.host = base.host
    // Keep pathname/search/hash from the original CDN URL.
    // If asset base includes a path prefix, join it in front of original pathname.
    const basePath = base.pathname.replace(/\/$/, "")
    if (basePath && basePath !== "") {
      swapped.pathname = `${basePath}${original.pathname}`
    }
    return swapped.href
  } catch {
    return null
  }
}

function getOverrideDefaultTmdbAssetServerHost(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem('debug.overrideDefaultTmdbAssetServerHost')
  } catch {
    return null
  }
}

function assetTypeForHost(hostname: string): MediaDatabaseType | null {
  if (TMDB_IMAGE_HOSTS.has(hostname)) return "tmdb-asset"
  if (TVDB_ARTWORK_HOSTS.has(hostname)) return "tvdb-asset"
  return null
}

/**
 * Build ordered image URL candidates: official CDN first, then discover asset mirrors (host-swap).
 */
export function buildAssetUrlCandidates(
  url: string,
  config: DiscoverConfig,
): string[] {
  const normalized = normalizeImageUrl(url)
  let hostname = ""
  try {
    hostname = new URL(normalized).hostname
  } catch {
    return [url]
  }

  const assetType = assetTypeForHost(hostname)
  const candidates: string[] = [normalized]
  if (!assetType) return candidates

  for (const entry of config.mediaDatabases) {
    if (entry.type !== assetType) continue
    const swapped = hostSwap(normalized, entry.url)
    if (!swapped) continue
    if (!candidates.includes(swapped)) candidates.push(swapped)
  }
  // Debug override: replace first candidate's host to simulate CDN failure
  // for testing failover to discover asset mirrors.
  const overrideHost = getOverrideDefaultTmdbAssetServerHost()
  if (overrideHost && assetType === 'tmdb-asset' && candidates.length > 0) {
    try {
      const overridden = new URL(candidates[0])
      overridden.host = overrideHost
      candidates[0] = overridden.href
    } catch {
      // ignore invalid override host
    }
  }

  return candidates
}
