import Debug from "debug"
import { fetchDiscoveredMediaDatabases, type MediaDatabaseEndpoint } from "@/api/discover"
import {
  probeEndpointReachability,
  REACHABILITY_PROBES_PER_URL,
  type ReachabilityResult,
} from "@/lib/mediaDatabaseReachability"
import localStorages from "@/lib/localStorages"

const debug = Debug("MediaDatabaseServiceDiscovery")

/**
 * Module-level state. Lives outside any React component so it survives
 * StrictMode double-mounts, HMR cycles, and parent re-renders. The
 * probe runs at most once per app session for the same reason.
 */
let cachedEndpoints: MediaDatabaseEndpoint[] = []
let hasStartedThisSession = false
let inFlightStart: Promise<void> | null = null
const subscribers = new Set<() => void>()

/**
 * Read the most recently discovered list of media-database endpoints.
 * Empty until `startMediaDatabaseServiceDiscovery()` resolves.
 */
export function getDiscoveredEndpoints(): MediaDatabaseEndpoint[] {
  return cachedEndpoints
}

/**
 * Subscribe to changes in the discovered endpoints. The callback is
 * invoked after `startMediaDatabaseServiceDiscovery()` resolves. The
 * returned function unsubscribes.
 */
export function subscribeToDiscovery(callback: () => void): () => void {
  subscribers.add(callback)
  return () => {
    subscribers.delete(callback)
  }
}

function notifySubscribers(): void {
  for (const cb of subscribers) {
    try {
      cb()
    } catch (err) {
      debug(`subscriber threw: %o`, err)
    }
  }
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
): Promise<void> {
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

  const perEndpointProbes = await Promise.all(
    filtered.map((e) =>
      Promise.all(
        Array.from({ length: REACHABILITY_PROBES_PER_URL }, () =>
          probeEndpointReachability(e),
        ),
      ),
    ),
  )

  const bestPerEndpoint: ReachabilityResult[] = perEndpointProbes
    .map((probes) => {
      const successful = probes.filter((p) => p.ok)
      if (successful.length === 0) return null
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
 * Start the media-database service discovery process. Fetches the
 * remote config, runs reachability probes against each discovered
 * endpoint, and stores the fastest URL per type in localStorage.
 *
 * This function is **idempotent within a session**: a second call
 * returns the in-flight or resolved promise of the first call, so the
 * network and probe work happens exactly once.
 *
 * Called from `main.tsx` (outside React) at app startup. Errors are
 * logged but never thrown, so a misbehaving CLI or unreachable
 * endpoints cannot crash the React tree.
 */
export function startMediaDatabaseServiceDiscovery(): Promise<void> {
  if (hasStartedThisSession && inFlightStart) {
    return inFlightStart
  }
  if (hasStartedThisSession) {
    return Promise.resolve()
  }
  hasStartedThisSession = true

  inFlightStart = (async () => {
    try {
      debug("starting media database service discovery")
      const endpoints = await fetchDiscoveredMediaDatabases()
      cachedEndpoints = endpoints
      debug("discovered %d endpoints", endpoints.length)

      await Promise.all([
        probeAndStore(endpoints, "tmdb"),
        probeAndStore(endpoints, "tvdb"),
      ])

      notifySubscribers()
      debug("media database service discovery complete")
    } catch (err) {
      debug("media database service discovery failed: %o", err)
    }
  })()

  return inFlightStart
}

/**
 * Test-only helper: resets the per-session guard and the cached
 * endpoint list. Use in `beforeEach` so each test exercises the
 * discovery path independently.
 */
export function _resetMediaDatabaseServiceDiscoveryForTesting(): void {
  hasStartedThisSession = false
  inFlightStart = null
  cachedEndpoints = []
  subscribers.clear()
}
