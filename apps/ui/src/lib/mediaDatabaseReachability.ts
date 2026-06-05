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
 * Probe a single endpoint with a GET fetch to measure reachability and
 * latency.
 *
 * We use `mode: "cors"` (the default) and attach the `Authorization`
 * header for endpoints that require a date-token. The request is sent
 * exactly as the search code path sends it, so it looks like a normal
 * request in the upstream's access logs and monitoring.
 *
 * Reachability is decided as follows:
 *
 *  - The fetch completes with a response (any HTTP status) → the host
 *    is reachable. We do not care about the status code; 401/404/500
 *    are all "reachable" because the host responded.
 *  - The fetch throws (network failure, DNS error, TLS error, CORS
 *    preflight rejection, abort/timeout) → the host is not reachable
 *    for our purposes. Note: a CORS-rejected response is reported by
 *    the browser as a `TypeError`, indistinguishable from a network
 *    failure, but in practice the SMM-managed endpoints all return
 *    CORS headers so this is not an issue.
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
    const response = await fetch(endpoint.url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...buildAuthHeader(endpoint.authorizationMethod),
      },
      signal: controller.signal,
    })
    const durationMs = performance.now() - start
    // Any HTTP response (2xx/3xx/4xx/5xx) means the host is reachable.
    // We deliberately ignore `response.ok` and `response.status` here.
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

function buildAuthHeader(
  authorizationMethod: MediaDatabaseEndpoint["authorizationMethod"],
): Record<string, string> {
  if (authorizationMethod === "date-token") {
    return { Authorization: `Bearer ${todayDateToken()}` }
  }
  return {}
}

export function pickFastestEndpoint(results: ReachabilityResult[]): MediaDatabaseEndpoint | null {
  const successful = results.filter((r) => r.ok)
  if (successful.length === 0) return null
  successful.sort((a, b) => a.durationMs - b.durationMs)
  return successful[0]!.endpoint
}
