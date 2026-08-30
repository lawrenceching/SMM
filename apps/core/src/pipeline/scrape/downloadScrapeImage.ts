import type { MediaMetadata, UserConfig } from "@smm/types";
import type { HostPerformanceStore } from "../../clients/hostPerformance";
import type { DiscoverConfig, DiscoverPort } from "../../ports/DiscoverPort";
import type { FetchInit, HttpResponse, NetworkPort } from "../../ports/NetworkPort";
import type { FsPort } from "../../ports/FsPort";
import { dirname } from "../paths";
import { assetTypeForHost, buildAssetUrlCandidates, hostSwap } from "./assetImageUrls";
import { resolveScrapeHttpProxy } from "./resolveScrapeHttpProxy";

/** Browser-like request headers for remote TMDB/TVDB image fetches. */
export const REMOTE_IMAGE_REQUEST_HEADERS: Record<string, string> = {
  accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  "sec-fetch-dest": "image",
  "sec-fetch-mode": "no-cors",
  "sec-fetch-site": "cross-site",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

const EMPTY_DISCOVER_CONFIG: DiscoverConfig = { mediaDatabases: [], reverseProxies: [] };

export interface DownloadScrapeImageDeps {
  discover?: DiscoverPort;
  hostPerformance?: HostPerformanceStore;
  /** Test hook: simulate TMDB CDN outage (see buildAssetUrlCandidates). */
  overrideDefaultTmdbAssetServerHost?: string | null;
  /**
   * Optional fetch override (e.g. proxied). Receives the resolved httpProxy
   * when a custom media-database host + proxy pair is configured.
   */
  fetch?: (input: string, init?: FetchInit, httpProxy?: string) => Promise<HttpResponse>;
}

function normalizeImageUrl(url: string): string {
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  return url;
}

async function fetchImageResponse(
  url: string,
  init: FetchInit,
  httpProxy: string | undefined,
  network: NetworkPort,
  customFetch: DownloadScrapeImageDeps["fetch"],
): Promise<HttpResponse> {
  if (customFetch) {
    return customFetch(url, init, httpProxy);
  }
  return network.fetch(url, init);
}

/**
 * Download one scrape image with TMDB/TVDB asset-server failover: try official CDN
 * URL first, then discover-configured asset mirrors (host-swap).
 */
export async function downloadScrapeImage(
  mediaMetadata: MediaMetadata,
  imageUrl: string,
  filePath: string,
  userConfig: UserConfig,
  fs: FsPort,
  network: NetworkPort,
  deps: DownloadScrapeImageDeps = {},
): Promise<void> {
  const httpProxy = resolveScrapeHttpProxy(mediaMetadata, userConfig);
  const normalizedUrl = normalizeImageUrl(imageUrl);

  if (
    !normalizedUrl.startsWith("http://") &&
    !normalizedUrl.startsWith("https://")
  ) {
    throw new Error(
      `Invalid image URL: ${imageUrl}. Must be http://, https://, or protocol-relative (//)`,
    );
  }

  const discoverConfig = deps.discover
    ? await deps.discover.getDiscoverConfig().catch(() => EMPTY_DISCOVER_CONFIG)
    : EMPTY_DISCOVER_CONFIG;

  const fallbackCandidates = buildAssetUrlCandidates(normalizedUrl, discoverConfig, {
    overrideDefaultTmdbAssetServerHost: deps.overrideDefaultTmdbAssetServerHost,
  });
  const candidates = orderAssetCandidates(normalizedUrl, fallbackCandidates, deps.hostPerformance);

  const init: FetchInit = {
    method: "GET",
    headers: REMOTE_IMAGE_REQUEST_HEADERS,
  };

  let lastError: Error | undefined;
  for (const candidate of candidates) {
    try {
      const response = await fetchImageResponse(
        candidate,
        init,
        httpProxy,
        network,
        deps.fetch,
      );
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        const parentDir = dirname(filePath);
        if (parentDir !== "/") {
          await fs.mkdir(parentDir);
        }
        await fs.writeBinaryFile(filePath, data);
        promoteAssetHost(normalizedUrl, candidate, deps.hostPerformance);
        return;
      }

      lastError = new Error(`HTTP error! status: ${response.status}`);
      promoteAssetHost(normalizedUrl, candidate, deps.hostPerformance);
      // HTTP-layer failure means the host is reachable — stop failover.
      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("Failed to download image: no candidates");
}

function orderAssetCandidates(
  originalUrl: string,
  fallbackCandidates: string[],
  hostPerformance: HostPerformanceStore | undefined,
): string[] {
  let hostname = "";
  try {
    hostname = new URL(originalUrl).hostname;
  } catch {
    return fallbackCandidates;
  }
  const assetType = assetTypeForHost(hostname);
  const list = assetType ? hostPerformance?.get(assetType) : undefined;
  if (!list || list.length === 0) return fallbackCandidates;

  const ordered: string[] = [];
  for (const entry of list) {
    const swapped = hostSwap(originalUrl, entry.host);
    if (swapped && !ordered.includes(swapped)) ordered.push(swapped);
  }
  return ordered.length > 0 ? ordered : fallbackCandidates;
}

function promoteAssetHost(
  originalUrl: string,
  succeededUrl: string,
  hostPerformance: HostPerformanceStore | undefined,
): void {
  if (!hostPerformance) return;
  let hostname = "";
  try {
    hostname = new URL(originalUrl).hostname;
  } catch {
    return;
  }
  const assetType = assetTypeForHost(hostname);
  if (!assetType) return;
  try {
    hostPerformance.promoteToTop(assetType, new URL(succeededUrl).origin);
  } catch {
    // ignore invalid URLs
  }
}
