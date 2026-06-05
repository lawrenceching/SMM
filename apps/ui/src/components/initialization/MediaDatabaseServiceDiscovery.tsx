import { useEffect } from "react"
import Debug from "debug"
import { useDiscoveredMediaDatabaseBaseUrls } from "@/hooks/useDiscoveredMediaDatabaseBaseUrls"
import localStorages from "@/lib/localStorages"
import {
  probeEndpointReachability,
  REACHABILITY_PROBES_PER_URL,
  type ReachabilityResult,
} from "@/lib/mediaDatabaseReachability"
import type { MediaDatabaseEndpoint } from "@/api/discover"

const debug = Debug("MediaDatabaseServiceDiscovery")

// Module-level guard: ensures the reachability probe runs at most once
// per app session, even when React's StrictMode mounts/unmounts the
// component twice in development or when the parent re-renders cause
// the effect to re-evaluate. Without this, each endpoint would receive
// 2x or 3x as many probe requests as expected.
let hasProbedThisSession = false

/**
 * Test-only helper: resets the per-session guard so unit tests that
 * render the component multiple times can exercise the probe path
 * independently for each test case.
 */
export function _resetMediaDatabaseServiceDiscoveryForTesting(): void {
  hasProbedThisSession = false
}

function serializePreferredEndpoint(endpoint: MediaDatabaseEndpoint): string {
  return JSON.stringify({
    url: endpoint.url,
    authorizationMethod: endpoint.authorizationMethod,
  })
}

async function probeAndStore(
  endpoints: MediaDatabaseEndpoint[],
  type: MediaDatabaseEndpoint["type"],
) {
  const filtered = endpoints.filter((e) => e.type === type)
  if (filtered.length === 0) {
    debug(`[${type}] no discovered endpoints, skipping reachability check`)
    return
  }

  debug(
    `[${type}] probing %d endpoint(s) with %d probes each`,
    filtered.length,
    REACHABILITY_PROBES_PER_URL,
  )

  // Probe each endpoint `REACHABILITY_PROBES_PER_URL` times in parallel
  // and pick the URL with the lowest measured latency. This gives a more
  // stable measurement than a single probe: a single slow probe (e.g.
  // a transient network hiccup or background tab throttling) cannot
  // disqualify an otherwise-fast endpoint.
  const perEndpointProbes = await Promise.all(
    filtered.map((e) =>
      Promise.all(
        Array.from({ length: REACHABILITY_PROBES_PER_URL }, () =>
          probeEndpointReachability(e),
        ),
      ),
    ),
  )

  // For each endpoint, keep only the successful probes and take the
  // best (lowest) duration. An endpoint with zero successful probes is
  // unreachable and excluded from selection.
  const bestPerEndpoint: ReachabilityResult[] = perEndpointProbes
    .map((probes) => {
      const successful = probes.filter((p) => p.ok)
      if (successful.length === 0) return null
      // Take the best (lowest durationMs) of the successful probes
      // for this single endpoint.
      return successful.reduce((best, cur) =>
        cur.durationMs < best.durationMs ? cur : best,
      )
    })
    .filter((r): r is ReachabilityResult => r !== null)

  debug(
    `[${type}] best latency per endpoint: %o`,
    bestPerEndpoint.map((r) => ({
      url: r.endpoint.url,
      durationMs: r.durationMs,
    })),
  )

  // Among the reachable endpoints, pick the one with the lowest
  // best-of-N duration. This satisfies the "lowest latency wins"
  // requirement at startup.
  if (bestPerEndpoint.length === 0) {
    debug(`[${type}] no reachable endpoints, not storing preference`)
    return
  }
  const fastestResult = bestPerEndpoint.reduce((best, cur) =>
    cur.durationMs < best.durationMs ? cur : best,
  )
  const fastest = fastestResult.endpoint
  const serialized = serializePreferredEndpoint(fastest)
  if (type === "tmdb") {
    localStorages.preferTmdbBaseUrl = serialized
  } else {
    localStorages.preferTvdbBaseUrl = serialized
  }
  debug(
    `[${type}] stored fastest: %s (%dms)`,
    serialized,
    fastestResult.durationMs,
  )
}

/**
 * Component that runs once at app startup. It probes the discovered
 * media-database endpoints, picks the fastest one per type, and writes
 * the result to localStorage. Subsequent search calls can then use the
 * preferred URL first.
 *
 * Each endpoint is probed multiple times (`REACHABILITY_PROBES_PER_URL`)
 * and the best (lowest) latency is used for selection. This makes the
 * preference stable in the face of transient network jitter or a single
 * unlucky probe.
 *
 * A module-level guard (`hasProbedThisSession`) ensures the probe runs
 * at most once per app session, even when React's StrictMode mounts
 * and re-mounts the component during development.
 *
 * This component is render-free; it only triggers side effects.
 */
export function MediaDatabaseServiceDiscovery() {
  const { data: endpoints } = useDiscoveredMediaDatabaseBaseUrls()

  useEffect(() => {
    if (!endpoints) return
    if (hasProbedThisSession) return
    hasProbedThisSession = true

    void probeAndStore(endpoints, "tmdb").catch((err: unknown) => {
      debug(`tmdb reachability check failed: %o`, err)
    })
    void probeAndStore(endpoints, "tvdb").catch((err: unknown) => {
      debug(`tvdb reachability check failed: %o`, err)
    })
  }, [endpoints])

  return null
}
