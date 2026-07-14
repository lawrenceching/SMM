import { isError, ExistedFileError } from "@core/errors"
import type { DownloadImageResponseBody } from "@core/types"
import { buildAssetUrlCandidates } from "@/lib/assetImageUrls"
import { fetchDiscoverConfig, type DiscoverConfig } from "./discover"
import { downloadImageApi as defaultDownloadImageApi } from "./downloadImage"

const EMPTY_DISCOVER_CONFIG: DiscoverConfig = { mediaDatabases: [], reverseProxies: [] }

export interface DownloadImageWithFailoverDeps {
  fetchDiscoverConfig?: () => Promise<DiscoverConfig>
  downloadImageApi?: (url: string, pathInPosix: string) => Promise<DownloadImageResponseBody>
}

export async function downloadImageWithFailover(
  url: string,
  pathInPosix: string,
  deps: DownloadImageWithFailoverDeps = {},
): Promise<DownloadImageResponseBody> {
  const fetchConfig = deps.fetchDiscoverConfig ?? fetchDiscoverConfig
  const download = deps.downloadImageApi ?? defaultDownloadImageApi

  const config = await fetchConfig().catch(() => EMPTY_DISCOVER_CONFIG)
  const candidates = buildAssetUrlCandidates(url, config)

  let last: DownloadImageResponseBody | undefined
  for (const candidate of candidates) {
    const response = await download(candidate, pathInPosix)
    last = response
    if (!response.error) return response
    if (isError(response.error, ExistedFileError)) return response
  }

  return (
    last ?? {
      data: { url, path: pathInPosix },
      error: "Failed to download image: no candidates",
    }
  )
}
