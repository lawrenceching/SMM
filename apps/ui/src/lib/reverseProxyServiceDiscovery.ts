import Debug from "debug"
import { fetchDiscoverConfig, type ReverseProxyEndpoint } from "@/api/discover"
import {
  appendLatencyTestSource,
  probeReverseProxyReachability,
  REACHABILITY_PROBES_PER_URL,
  type ReverseProxyReachabilityResult,
} from "@/lib/reverseProxyReachability"
import localStorages from "@/lib/localStorages"

const debug = Debug("ReverseProxyServiceDiscovery")

let cachedProxies: ReverseProxyEndpoint[] = []
let hasStartedThisSession = false
let inFlightStart: Promise<void> | null = null
const subscribers = new Set<() => void>()

export function getDiscoveredReverseProxies(): ReverseProxyEndpoint[] {
  return cachedProxies
}

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

function serializePreferred(endpoint: ReverseProxyEndpoint): string {
  return JSON.stringify({
    id: endpoint.id,
    url: endpoint.url,
    authorizationMethod: endpoint.authorizationMethod,
  })
}

function clearLegacyPreferKeys(): void {
  localStorages.preferTmdbBaseUrl = null
  localStorages.preferTvdbBaseUrl = null
}

/**
 * If the new prefer key is empty, try to seed it from legacy per-DB prefers
 * when the stored URL matches a discovered reverse proxy.
 */
function migrateLegacyPreferIfNeeded(proxies: ReverseProxyEndpoint[]): void {
  if (localStorages.preferReverseProxyBaseUrl) {
    clearLegacyPreferKeys()
    return
  }

  const candidates = [localStorages.preferTmdbBaseUrl, localStorages.preferTvdbBaseUrl]
  for (const raw of candidates) {
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw) as { url?: string }
      if (typeof parsed.url !== "string") continue
      const match = proxies.find((p) => p.url === parsed.url)
      if (match) {
        localStorages.preferReverseProxyBaseUrl = serializePreferred(match)
        debug("migrated legacy prefer to preferReverseProxyBaseUrl: %s", match.url)
        break
      }
    } catch {
      // ignore malformed legacy values
    }
  }

  clearLegacyPreferKeys()
}

async function probeAndStore(proxies: ReverseProxyEndpoint[]): Promise<void> {
  if (proxies.length === 0) {
    debug("no reverse proxies, skipping reachability check")
    return
  }

  debug(
    "probing %d reverse proxy(ies) with %d probes each",
    proxies.length,
    REACHABILITY_PROBES_PER_URL,
  )

  const perProxyProbes = await Promise.all(
    proxies.map((p) =>
      Promise.all(
        Array.from({ length: REACHABILITY_PROBES_PER_URL }, (_, probeIndex) => {
          const taggedBaseUrl = appendLatencyTestSource(p.url, probeIndex + 1)
          return probeReverseProxyReachability(p, { taggedBaseUrl }).then((result) => ({
            ...result,
            endpoint: p,
          }))
        }),
      ),
    ),
  )

  const bestPerProxy: ReverseProxyReachabilityResult[] = perProxyProbes
    .map((probes) => {
      const successful = probes.filter((r) => r.ok)
      if (successful.length === 0) return null
      return successful.reduce((best, cur) =>
        cur.durationMs < best.durationMs ? cur : best,
      )
    })
    .filter((r): r is ReverseProxyReachabilityResult => r !== null)

  if (bestPerProxy.length === 0) {
    debug("no reachable reverse proxies, not storing preference")
    return
  }

  const fastestResult = bestPerProxy.reduce((best, cur) =>
    cur.durationMs < best.durationMs ? cur : best,
  )
  const fastest = fastestResult.endpoint
  const serialized = serializePreferred(fastest)
  localStorages.preferReverseProxyBaseUrl = serialized
  debug("stored fastest reverse proxy: %s (%dms)", serialized, fastestResult.durationMs)
}

/**
 * Discover remote OpenResty reverse proxies, probe latency, and store the
 * fastest URL in `preferReverseProxyBaseUrl`. Idempotent within a session.
 */
export function startReverseProxyServiceDiscovery(): Promise<void> {
  if (hasStartedThisSession && inFlightStart) {
    return inFlightStart
  }
  if (hasStartedThisSession) {
    return Promise.resolve()
  }
  hasStartedThisSession = true

  inFlightStart = (async () => {
    try {
      debug("starting reverse proxy service discovery")
      const config = await fetchDiscoverConfig()
      const proxies = config.reverseProxies
      cachedProxies = proxies
      debug("discovered %d reverse proxies", proxies.length)

      migrateLegacyPreferIfNeeded(proxies)
      await probeAndStore(proxies)

      notifySubscribers()
      debug("reverse proxy service discovery complete")
    } catch (err) {
      debug("reverse proxy service discovery failed: %o", err)
    }
  })()

  return inFlightStart
}

export function _resetReverseProxyServiceDiscoveryForTesting(): void {
  hasStartedThisSession = false
  inFlightStart = null
  cachedProxies = []
  subscribers.clear()
}
