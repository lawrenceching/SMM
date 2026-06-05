import { useEffect, useMemo, useState } from "react"
import { SMM_TMDB_DEFAULT_UPSTREAM } from "@/api/tmdb"
import { SMM_TVDB_DEFAULT_UPSTREAM } from "@/lib/TvdbUtils"
import {
  getDiscoveredEndpoints,
  subscribeToDiscovery,
} from "@/lib/mediaDatabaseServiceDiscovery"
import localStorages from "@/lib/localStorages"
import type {
  MediaDatabaseAuthorizationMethod,
  MediaDatabaseEndpoint,
} from "@/api/discover"

export type MediaDatabaseType = "tmdb" | "tvdb"

export interface MediaDatabaseBaseUrl {
  url: string
  authorizationMethod: MediaDatabaseAuthorizationMethod
}

const DEFAULT_ENDPOINTS: Record<MediaDatabaseType, MediaDatabaseBaseUrl> = {
  tmdb: { url: SMM_TMDB_DEFAULT_UPSTREAM, authorizationMethod: "none" },
  tvdb: { url: SMM_TVDB_DEFAULT_UPSTREAM, authorizationMethod: "none" },
}

function readPreferredFromLocalStorage(
  type: MediaDatabaseType,
): MediaDatabaseBaseUrl | null {
  const raw =
    type === "tmdb" ? localStorages.preferTmdbBaseUrl : localStorages.preferTvdbBaseUrl
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as Record<string, unknown>).url === "string"
    ) {
      const { url, authorizationMethod } = parsed as Record<string, unknown>
      return {
        url: url as string,
        authorizationMethod:
          authorizationMethod === "date-token" ? "date-token" : "none",
      }
    }
    return null
  } catch {
    return null
  }
}

function dedupe(endpoints: MediaDatabaseBaseUrl[]): MediaDatabaseBaseUrl[] {
  const seen = new Set<string>()
  const result: MediaDatabaseBaseUrl[] = []
  for (const ep of endpoints) {
    if (seen.has(ep.url)) continue
    seen.add(ep.url)
    result.push(ep)
  }
  return result
}

function toBaseUrl(endpoint: MediaDatabaseEndpoint): MediaDatabaseBaseUrl {
  return {
    url: endpoint.url,
    authorizationMethod: endpoint.authorizationMethod,
  }
}

/**
 * Build a deduplicated, priority-ordered list of media database base
 * URLs for a given type. The priority order is:
 *
 *   1. The URL stored in localStorage from the startup reachability check
 *      (i.e. the fastest reachable endpoint)
 *   2. Other endpoints discovered from the remote config
 *   3. The hardcoded default SMM upstream (always last, as a safety net)
 *
 * The hardcoded default is always included (when not already in the
 * discovered list) so the search can always fall back to it.
 *
 * This hook reads from localStorage and the module-level discovery
 * cache (populated by `startMediaDatabaseServiceDiscovery`). It does
 * not issue any HTTP requests of its own. It re-runs when the
 * discovery cache changes (via the `subscribeToDiscovery` callback)
 * and when localStorage is touched.
 */
export function useMediaDatabaseBaseUrls(type: MediaDatabaseType): MediaDatabaseBaseUrl[] {
  const [discovered, setDiscovered] = useState<MediaDatabaseEndpoint[]>(() =>
    getDiscoveredEndpoints(),
  )
  const [localStorageVersion, setLocalStorageVersion] = useState(0)

  useEffect(() => {
    return subscribeToDiscovery(() => {
      setDiscovered(getDiscoveredEndpoints())
    })
  }, [])

  // Pick up localStorage changes made by other parts of the app or by
  // external edits. We only need to re-render when the value actually
  // changes, so we read on every render and bump a version counter.
  useEffect(() => {
    const refresh = (): void => {
      setLocalStorageVersion((v) => v + 1)
    }
    window.addEventListener("storage", refresh)
    const interval = window.setInterval(refresh, 1000)
    return () => {
      window.removeEventListener("storage", refresh)
      window.clearInterval(interval)
    }
  }, [])

  return useMemo<MediaDatabaseBaseUrl[]>(() => {
    const preferred = readPreferredFromLocalStorage(type)
    const discoveredForType = discovered.filter((e) => e.type === type)

    const ordered: MediaDatabaseBaseUrl[] = []
    if (preferred) ordered.push(preferred)
    for (const ep of discoveredForType) {
      if (preferred && preferred.url === ep.url) continue
      ordered.push(toBaseUrl(ep))
    }
    const defaultEndpoint = DEFAULT_ENDPOINTS[type]
    if (!ordered.some((e) => e.url === defaultEndpoint.url)) {
      ordered.push(defaultEndpoint)
    }
    return dedupe(ordered)
  }, [type, discovered, localStorageVersion])
}
