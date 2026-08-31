import {
  buildAssetUrlCandidates as buildAssetUrlCandidatesCore,
  type BuildAssetUrlCandidatesOptions,
} from "@smm/core/pipeline/scrape/assetImageUrls";
import type { DiscoverConfig } from "@/api/discover";

export {
  TMDB_IMAGE_HOSTS,
  TVDB_ARTWORK_HOSTS,
  hostSwap,
  assetTypeForHost,
} from "@smm/core/pipeline/scrape/assetImageUrls";

function readDebugOverrideHost(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem("debug.overrideDefaultTmdbAssetServerHost");
  } catch {
    return null;
  }
}

/**
 * UI entry for asset URL candidates. Reads optional localStorage debug override
 * and forwards to Core pipeline {@link buildAssetUrlCandidatesCore}.
 */
export function buildAssetUrlCandidates(
  url: string,
  config: DiscoverConfig,
  options: BuildAssetUrlCandidatesOptions = {},
): string[] {
  return buildAssetUrlCandidatesCore(url, config, {
    ...options,
    overrideDefaultTmdbAssetServerHost:
      options.overrideDefaultTmdbAssetServerHost ?? readDebugOverrideHost(),
  });
}
