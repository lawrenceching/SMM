import { useEffect, useMemo, useState } from "react"
import {
  getDiscoveredReverseProxies,
  subscribeToDiscovery,
} from "@/lib/reverseProxyServiceDiscovery"
import localStorages from "@/lib/localStorages"
import { useConfig } from "@/hooks/userConfig"
import type { ReverseProxyEndpoint } from "@/api/discover"
import type { ProxyAuthorizationMethod } from "@/lib/proxyRequestHeaders"

/** A remote general reverse proxy candidate (OpenResty / discover API). */
export interface ReverseProxyCandidate {
  id: string
  url: string
  authorizationMethod: ProxyAuthorizationMethod
}

function readPreferredFromLocalStorage(): ReverseProxyCandidate | null {
  const raw = localStorages.preferReverseProxyBaseUrl
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as Record<string, unknown>).url === "string"
    ) {
      const { id, url, authorizationMethod } = parsed as Record<string, unknown>
      return {
        id: typeof id === "string" && id.trim() ? id : "preferred",
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

function toCandidate(endpoint: ReverseProxyEndpoint): ReverseProxyCandidate {
  return {
    id: endpoint.id,
    url: endpoint.url,
    authorizationMethod: endpoint.authorizationMethod,
  }
}

function dedupe(candidates: ReverseProxyCandidate[]): ReverseProxyCandidate[] {
  const seen = new Set<string>()
  const result: ReverseProxyCandidate[] = []
  for (const c of candidates) {
    if (seen.has(c.url)) continue
    seen.add(c.url)
    result.push(c)
  }
  return result
}

/**
 * Priority-ordered reverse proxy candidates for MediaDatabaseSearchbox:
 * 1. Local SMM reverse proxy from hello / appConfig
 * 2. Preferred remote from localStorage (fastest from last probe)
 * 3. Other discovered remotes
 */
export function useReverseProxyBaseUrls(): ReverseProxyCandidate[] {
  const { appConfig } = useConfig()
  const [discovered, setDiscovered] = useState<ReverseProxyEndpoint[]>(() =>
    getDiscoveredReverseProxies(),
  )
  const [localStorageVersion, setLocalStorageVersion] = useState(0)

  useEffect(() => {
    return subscribeToDiscovery(() => {
      setDiscovered(getDiscoveredReverseProxies())
    })
  }, [])

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

  const localUrl = appConfig.reverseProxyUrl?.trim() ?? ""

  return useMemo<ReverseProxyCandidate[]>(() => {
    const ordered: ReverseProxyCandidate[] = []

    if (localUrl) {
      ordered.push({
        id: "local",
        url: localUrl,
        authorizationMethod: "none",
      })
    }

    const preferred = readPreferredFromLocalStorage()
    if (preferred) {
      ordered.push(preferred)
    }

    for (const ep of discovered) {
      ordered.push(toCandidate(ep))
    }

    return dedupe(ordered)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localUrl, discovered, localStorageVersion])
}
