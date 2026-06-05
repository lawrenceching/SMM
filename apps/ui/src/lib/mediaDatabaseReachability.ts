import type { MediaDatabaseEndpoint } from "@/api/discover"
import { todayDateToken } from "@/lib/mediaDatabaseDateToken"

export { todayDateToken }

const REACHABILITY_TIMEOUT_MS = 10_000
export const REACHABILITY_PROBES_PER_URL = 3

export interface ReachabilityResult {
  endpoint: MediaDatabaseEndpoint
  ok: boolean
  durationMs: number
  error?: string
}

/**
 * Probe a single endpoint with a GET fetch to measure TCP-layer
 * reachability and latency.
 *
 * We intentionally use `mode: "no-cors"` for two reasons:
 *
 *  1. The browser will not enforce CORS preflight, so the request is
 *     always sent — the response is "opaque" (status/headers/body not
 *     visible from JS) but the lack of an error means the host
 *     responded. This is exactly the "TCP-layer reachability" semantic
 *     required: we only care whether the host is up, not the HTTP code.
 *
 *  2. `no-cors` mode strips non-safelisted headers, including
 *     `Authorization`. The token-aware search path uses `mode: "cors"`
 *     separately (see `searchTmdbDirect` / `searchTvdbDirect`), so the
 *     reachability probe does not need to attach a `Bearer` token.
 *
 * Any 2xx/3xx/4xx/5xx response is treated as success (`ok: true`).
 * Only true network failures (DNS, TCP refused, TLS, timeout) count as
 * failure.
 */
export async function probeEndpointReachability(
  endpoint: MediaDatabaseEndpoint,
  signal?: AbortSignal,
): Promise<ReachabilityResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REACHABILITY_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener("abort", onAbort)
  }

  const start = performance.now()
  try {
    await fetch(endpoint.url, {
      method: "GET",
      mode: "no-cors",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    })
    const durationMs = performance.now() - start
    // In no-cors mode, response.ok is always false and status is 0; we
    // treat the lack of an error as success (the server was reached).
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

export function pickFastestEndpoint(results: ReachabilityResult[]): MediaDatabaseEndpoint | null {
  const successful = results.filter((r) => r.ok)
  if (successful.length === 0) return null
  successful.sort((a, b) => a.durationMs - b.durationMs)
  return successful[0]!.endpoint
}
