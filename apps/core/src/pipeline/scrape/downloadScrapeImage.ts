import { isEmpty } from "es-toolkit/compat";
import type { MediaMetadata, UserConfig } from "@smm/core";
import type { FetchInit, HttpResponse, NetworkPort } from "../../ports/NetworkPort";
import type { FsPort } from "../../ports/FsPort";
import { dirname } from "../paths";
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

export interface DownloadScrapeImageDeps {
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

/**
 * Download one scrape image: resolve HTTP proxy from metadata, fetch via
 * NetworkPort, mkdir parent, write bytes with FsPort.writeBinaryFile.
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

  const init: FetchInit = {
    method: "GET",
    headers: REMOTE_IMAGE_REQUEST_HEADERS,
  };

  const response = deps.fetch
    ? await deps.fetch(normalizedUrl, init, httpProxy)
    : await network.fetch(normalizedUrl, init);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  const parentDir = dirname(filePath);
  if (parentDir !== "/") {
    await fs.mkdir(parentDir);
  }
  await fs.writeBinaryFile(filePath, data);
}
