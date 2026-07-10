import type { ReverseProxyEndpoint } from "@/api/discover"
import { SMM_TMDB_DEFAULT_UPSTREAM } from "@/api/tmdb"
import { buildGeneralProxyRequestHeaders } from "./proxyRequestHeaders"

const REACHABILITY_TIMEOUT_MS = 10_000
export const REACHABILITY_PROBES_PER_URL = 3

export interface ReverseProxyReachabilityResult {
  endpoint: ReverseProxyEndpoint
  ok: boolean
  durationMs: number
  error?: string
}

export interface ProbeReverseProxyOptions {
  /**
   * Optional proxy base URL that may already include `?source=latencytest-N`.
   * When omitted, `endpoint.url` is used.
   */
  taggedBaseUrl?: string
  signal?: AbortSignal
}

/**
 * Append `?source=latencytest-N` (or `&source=` when a query already exists).
 */
export function appendLatencyTestSource(url: string, probeNumber: number): string {
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}source=latencytest-${probeNumber}`
}

function buildProbeUrl(proxyBaseUrl: string): string {
  const base = new URL(proxyBaseUrl)
  const pathBase = `${base.origin}${base.pathname.replace(/\/+$/, "")}`
  const params = new URLSearchParams(base.search)
  params.set("query", "__probe__")
  params.set("language", "en-US")
  return `${pathBase}/search/tv?${params.toString()}`
}

/**
 * Probe a remote OpenResty reverse proxy with a TMDB-shaped search request
 * so latency matches the Searchbox code path.
 */
export async function probeReverseProxyReachability(
  endpoint: ReverseProxyEndpoint,
  options?: ProbeReverseProxyOptions,
): Promise<ReverseProxyReachabilityResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REACHABILITY_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  const signal = options?.signal
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener("abort", onAbort)
  }

  const start = performance.now()
  try {
    const url = buildProbeUrl(options?.taggedBaseUrl ?? endpoint.url)
    const response = await fetch(url, {
      method: "GET",
      headers: buildGeneralProxyRequestHeaders({
        upstreamBaseURL: SMM_TMDB_DEFAULT_UPSTREAM,
        authorizationMethod: endpoint.authorizationMethod,
      }),
      signal: controller.signal,
    })
    const durationMs = performance.now() - start
    void response
    return { endpoint, ok: true, durationMs }
  } catch (error) {
    const durationMs = performance.now() - start
    return {
      endpoint,
      ok: false,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timeout)
    if (signal) signal.removeEventListener("abort", onAbort)
  }
}

export function pickFastestReverseProxy(
  results: ReverseProxyReachabilityResult[],
): ReverseProxyEndpoint | null {
  const successful = results.filter((r) => r.ok)
  if (successful.length === 0) return null
  successful.sort((a, b) => a.durationMs - b.durationMs)
  return successful[0]!.endpoint
}
