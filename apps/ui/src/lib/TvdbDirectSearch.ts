import type { TVDBv4SearchParams, TVDBv4SearchResult } from "@smm/tvdb4/types"
import type { MediaDatabaseAuthorizationMethod } from "@/api/discover"
import { todayDateToken } from "@/lib/mediaDatabaseDateToken"

export interface TvdbDirectSearchOptions {
  baseUrl: string
  authorizationMethod?: MediaDatabaseAuthorizationMethod
  signal?: AbortSignal
}

interface TvdbDirectSearchResponse {
  status: "success" | "failure"
  data?: TVDBv4SearchResult[]
  message?: string
}

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

function buildQuery(params: TVDBv4SearchParams): URLSearchParams {
  const sp = new URLSearchParams()
  const query = params.query.trim()
  if (query) sp.set("query", query)
  if (params.type) sp.set("type", params.type)
  if (params.language?.trim()) sp.set("language", params.language.trim())
  if (params.year) sp.set("year", String(params.year))
  if (params.country?.trim()) sp.set("country", params.country.trim())
  if (params.director?.trim()) sp.set("director", params.director.trim())
  if (params.company?.trim()) sp.set("company", params.company.trim())
  if (params.network?.trim()) sp.set("network", params.network.trim())
  if (params.offset !== undefined) sp.set("offset", String(params.offset))
  if (params.limit !== undefined) sp.set("limit", String(params.limit))
  if (params.page !== undefined) sp.set("page", String(params.page))
  return sp
}

/**
 * Search TVDB by issuing a direct call to a discovered upstream URL,
 * bypassing the SMM reverse proxy. Returns the parsed `data` array on
 * a successful response, or `undefined` on a TVDB-level failure
 * envelope.
 *
 * Throws on network failure or non-2xx response.
 */
export async function searchTvdbDirect(
  params: TVDBv4SearchParams,
  options: TvdbDirectSearchOptions,
): Promise<TVDBv4SearchResult[] | undefined> {
  const baseUrl = options.baseUrl.replace(/\/+$/, "")
  const sp = buildQuery(params)
  const queryString = sp.toString()
  const url = `${baseUrl}/search${queryString ? `?${queryString}` : ""}`

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(options.authorizationMethod),
    signal: options.signal,
  })
  if (!response.ok) {
    throw new Error(
      `Direct TVDB search failed: ${response.status} ${response.statusText} (${baseUrl})`,
    )
  }
  const body = (await response.json()) as TvdbDirectSearchResponse
  if (body.status === "success") return body.data
  return undefined
}
