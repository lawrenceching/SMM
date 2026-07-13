import { buildAssetUrlCandidates } from "@/lib/assetImageUrls"
import { fetchDiscoverConfig, type DiscoverConfig } from "./discover"

export interface FetchProxiedImageWithFailoverDeps {
  fetchDiscoverConfig?: () => Promise<DiscoverConfig>
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>
  signal?: AbortSignal
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  )
}

export async function fetchProxiedImageWithFailover(
  imageUrl: string,
  deps: FetchProxiedImageWithFailoverDeps = {},
): Promise<Blob> {
  const fetchConfig = deps.fetchDiscoverConfig ?? fetchDiscoverConfig
  const fetchImpl = deps.fetchImpl ?? fetch
  const config = await fetchConfig()
  const candidates = buildAssetUrlCandidates(imageUrl, config)

  let lastError: unknown
  for (const candidate of candidates) {
    const apiUrl = `/api/image?url=${encodeURIComponent(candidate)}`
    try {
      const response = await fetchImpl(apiUrl, { signal: deps.signal })
      if (!response.ok) {
        lastError = new Error(`Failed to download image: ${response.statusText}`)
        continue
      }
      return await response.blob()
    } catch (error) {
      if (isAbortError(error)) throw error
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to download image: ${String(lastError)}`)
}
