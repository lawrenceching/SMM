import type { MediaMetadata, UserConfig } from "@core/types"
import { downloadImageWithFailover } from "@/api/downloadImageWithFailover"
import { resolveScrapeHttpProxy } from "@/lib/mediaDatabaseAccess"

export interface DownloadScrapeImageDeps {
  downloadImageWithFailover?: typeof downloadImageWithFailover
}

/**
 * Download one scrape image, routing through the user-configured TMDB/TVDB
 * HTTP proxy when a custom host + proxy pair is configured. Throws on failure.
 */
export async function downloadScrapeImage(
  mediaMetadata: MediaMetadata,
  imageUrl: string,
  filePath: string,
  userConfig: UserConfig,
  deps: DownloadScrapeImageDeps = {},
): Promise<void> {
  const download = deps.downloadImageWithFailover ?? downloadImageWithFailover
  const httpProxy = resolveScrapeHttpProxy(mediaMetadata, userConfig)
  const response = await download(imageUrl, filePath, { httpProxy })
  if (response.error) {
    throw new Error(response.error)
  }
}
