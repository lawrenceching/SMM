import { proxiableFetch } from "@smm/utils/proxiableFetch"
import { buildLocalProxyRequestHeaders, buildGeneralProxyRequestHeaders } from "./proxyRequestHeaders"
import type { ReverseProxyCandidate } from "@/hooks/useReverseProxyBaseUrls"
import {
  isCustomUpstream,
  normalizeUpstreamBaseUrl,
  shouldTryDirectUpstream,
  filterProxiesByDisabledDomains,
} from "./mediaDatabaseAccess"

export interface MediaDatabaseFetchOptions {
  /** Path appended to each attempt base URL (e.g. `/search/tv?query=foo`). */
  path: string
  /** Resolved upstream base URL (custom host or SMM default). */
  upstreamBaseUrl: string
  /** SMM default upstream for this database (TMDB or TVDB). */
  defaultUpstreamBaseUrl: string
  /** Local SMM reverse proxy — required when upstream is user-customized. */
  localReverseProxyUrl?: string | null
  /** General reverse proxies for default-upstream failover. */
  generalProxies?: ReverseProxyCandidate[]
  abortOnHttpError?: boolean
  fetchFn?: typeof fetch
  /** Upstream API key (TMDB/TVDB Authorization header). */
  apiKey?: string
}

function authExtra(apiKey?: string): Record<string, string> | undefined {
  const key = apiKey?.trim()
  if (!key) return undefined
  return { Authorization: `Bearer ${key}` }
}

/**
 * @deprecated Direct callers should use `fetchTmdb` (apps/ui/src/api/tmdb.ts)
 * or `fetchTvdb` (apps/ui/src/api/tvdb.ts) instead. This helper is kept only
 * for backwards compatibility. The intermediate wrappers
 * `mediaDatabaseSearchFetch`, `useGeneralReverseProxyUrls`, and
 * `getGeneralReverseProxyCandidates` have been removed in 2026-07-10.
 */
export async function mediaDatabaseFetch(
  options: MediaDatabaseFetchOptions,
  init: RequestInit = {},
): Promise<Response> {
  const upstreamBaseUrl = normalizeUpstreamBaseUrl(options.upstreamBaseUrl)
  if (!upstreamBaseUrl) {
    throw new Error("mediaDatabaseFetch: upstreamBaseUrl is required")
  }

  const defaultUpstream = normalizeUpstreamBaseUrl(options.defaultUpstreamBaseUrl)
  const path = options.path.startsWith("/") ? options.path : `/${options.path}`
  const extra = authExtra(options.apiKey)
  const filteredProxies = filterProxiesByDisabledDomains(options.generalProxies ?? [])

  if (isCustomUpstream(upstreamBaseUrl, defaultUpstream)) {
    const localReverseProxyUrl = options.localReverseProxyUrl?.trim()
    if (!localReverseProxyUrl) {
      throw new Error(
        "mediaDatabaseFetch: localReverseProxyUrl is required for a custom upstream",
      )
    }
    return proxiableFetch(
      {
        path,
        urls: [localReverseProxyUrl.replace(/\/+$/, "")],
        reverseProxies: [],
        abortOnHttpError: options.abortOnHttpError,
        fetchFn: options.fetchFn,
        beforeFetch: () =>
          buildLocalProxyRequestHeaders({
            upstreamBaseURL: upstreamBaseUrl,
            extra,
          }),
      },
      init,
    )
  }

  const tryDirect = shouldTryDirectUpstream(upstreamBaseUrl, defaultUpstream)
  const authByUrl = new Map(
    filteredProxies.map(
      (p) => [p.url.replace(/\/+$/, ""), p.authorizationMethod] as const,
    ),
  )
  const reverseProxyUrls = filteredProxies.map((p) => p.url.replace(/\/+$/, ""))

  if (!tryDirect) {
    if (reverseProxyUrls.length === 0) {
      throw new Error(
        "mediaDatabaseFetch: direct upstream is disabled and no general reverse proxies are available",
      )
    }
    return proxiableFetch(
      {
        path,
        urls: reverseProxyUrls,
        reverseProxies: [],
        abortOnHttpError: options.abortOnHttpError,
        fetchFn: options.fetchFn,
        beforeFetch: ({ context }) => {
          const proxyUrl = reverseProxyUrls[context.urlIndex] ?? ""
          const authorizationMethod = authByUrl.get(proxyUrl) ?? "none"
          return buildGeneralProxyRequestHeaders({
            upstreamBaseURL: upstreamBaseUrl,
            authorizationMethod,
            extra,
          })
        },
      },
      init,
    )
  }

  return proxiableFetch(
    {
      path,
      urls: [upstreamBaseUrl],
      reverseProxies: reverseProxyUrls,
      abortOnHttpError: options.abortOnHttpError,
      fetchFn: options.fetchFn,
      beforeFetch: ({ proxy }) => {
        if (!proxy) {
          const headers: Record<string, string> = { Accept: "application/json" }
          if (extra) Object.assign(headers, extra)
          return headers
        }
        const normalizedProxy = proxy.replace(/\/+$/, "")
        const authorizationMethod = authByUrl.get(normalizedProxy) ?? "none"
        return buildGeneralProxyRequestHeaders({
          upstreamBaseURL: upstreamBaseUrl,
          authorizationMethod,
          extra,
        })
      },
    },
    init,
  )
}
