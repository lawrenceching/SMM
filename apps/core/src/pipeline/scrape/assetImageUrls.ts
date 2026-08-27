import type { DiscoverConfig, MediaDatabaseType } from "../../ports/DiscoverPort";

export const TMDB_IMAGE_HOSTS = new Set(["image.tmdb.org"]);
export const TVDB_ARTWORK_HOSTS = new Set(["artworks.thetvdb.com"]);

export interface BuildAssetUrlCandidatesOptions {
  /** Test hook: replace the first TMDB CDN candidate host to simulate outage. */
  overrideDefaultTmdbAssetServerHost?: string | null;
}

function normalizeImageUrl(url: string): string {
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function hostSwap(originalUrl: string, assetBaseUrl: string): string | null {
  try {
    const original = new URL(originalUrl);
    const base = new URL(assetBaseUrl);
    const swapped = new URL(original.href);
    swapped.protocol = base.protocol;
    swapped.host = base.host;
    const basePath = base.pathname.replace(/\/$/, "");
    if (basePath && basePath !== "") {
      swapped.pathname = `${basePath}${original.pathname}`;
    }
    return swapped.href;
  } catch {
    return null;
  }
}

function assetTypeForHost(hostname: string): MediaDatabaseType | null {
  if (TMDB_IMAGE_HOSTS.has(hostname)) return "tmdb-asset";
  if (TVDB_ARTWORK_HOSTS.has(hostname)) return "tvdb-asset";
  return null;
}

/**
 * Build ordered image URL candidates: official CDN first, then discover asset mirrors (host-swap).
 */
export function buildAssetUrlCandidates(
  url: string,
  config: DiscoverConfig,
  options: BuildAssetUrlCandidatesOptions = {},
): string[] {
  const normalized = normalizeImageUrl(url);
  let hostname = "";
  try {
    hostname = new URL(normalized).hostname;
  } catch {
    return [url];
  }

  const assetType = assetTypeForHost(hostname);
  const candidates: string[] = [normalized];
  if (!assetType) return candidates;

  for (const entry of config.mediaDatabases) {
    if (entry.type !== assetType) continue;
    const swapped = hostSwap(normalized, entry.url);
    if (!swapped) continue;
    if (!candidates.includes(swapped)) candidates.push(swapped);
  }

  const overrideHost = options.overrideDefaultTmdbAssetServerHost;
  if (overrideHost && assetType === "tmdb-asset" && candidates.length > 0) {
    try {
      const overridden = new URL(candidates[0]);
      overridden.host = overrideHost;
      candidates[0] = overridden.href;
    } catch {
      // ignore invalid override host
    }
  }

  return candidates;
}
