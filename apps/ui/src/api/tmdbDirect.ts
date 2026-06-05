import type { TmdbSearchResponseBody } from "@core/types"
import type { MediaDatabaseAuthorizationMethod } from "@/api/discover"
import { todayDateToken } from "@/lib/mediaDatabaseDateToken"

export interface TmdbDirectSearchOptions {
  baseUrl: string
  authorizationMethod?: MediaDatabaseAuthorizationMethod
  signal?: AbortSignal
}

/**
 * Build request headers for a direct TMDB upstream call.
 */
function buildHeaders(
  authorizationMethod: MediaDatabaseAuthorizationMethod | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  }
  if (authorizationMethod === "date-token") {
    headers.Authorization = `Bearer ${todayDateToken()}`
  }
  return headers
}

/**
 * Search TMDB by issuing a direct call to a discovered upstream URL,
 * bypassing the SMM reverse proxy. Use this when iterating over a
 * list of base URLs returned by `useMediaDatabaseBaseUrls`.
 *
 * Throws on network failure or non-2xx response.
 */
export async function searchTmdbDirect(
  keyword: string,
  type: "movie" | "tv",
  language: "zh-CN" | "en-US" | "ja-JP",
  options: TmdbDirectSearchOptions,
): Promise<TmdbSearchResponseBody> {
  const baseUrl = options.baseUrl.replace(/\/+$/, "")
  const params = new URLSearchParams()
  params.append("query", keyword)
  params.append("language", language)
  const url = `${baseUrl}/search/${type}?${params.toString()}`

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(options.authorizationMethod),
    signal: options.signal,
  })
  if (!response.ok) {
    throw new Error(
      `Direct TMDB search failed: ${response.status} ${response.statusText} (${baseUrl})`,
    )
  }
  return (await response.json()) as TmdbSearchResponseBody
}
