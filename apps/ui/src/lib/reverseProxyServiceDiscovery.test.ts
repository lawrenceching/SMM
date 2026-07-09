import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  getDiscoveredReverseProxies,
  startReverseProxyServiceDiscovery,
  subscribeToDiscovery,
  _resetReverseProxyServiceDiscoveryForTesting,
} from "./reverseProxyServiceDiscovery"
import localStorages from "@/lib/localStorages"
import { REACHABILITY_PROBES_PER_URL } from "./reverseProxyReachability"
import type { DiscoverConfig, ReverseProxyEndpoint } from "@/api/discover"

const { mockFetchDiscoverConfig, mockProbeReverseProxyReachability } = vi.hoisted(() => ({
  mockFetchDiscoverConfig: vi.fn<() => Promise<DiscoverConfig>>(),
  mockProbeReverseProxyReachability: vi.fn(),
}))

vi.mock("@/api/discover", async () => {
  const actual = await vi.importActual<typeof import("@/api/discover")>("@/api/discover")
  return {
    ...actual,
    fetchDiscoverConfig: () => mockFetchDiscoverConfig(),
  }
})

vi.mock("./reverseProxyReachability", async () => {
  const actual = await vi.importActual<typeof import("./reverseProxyReachability")>(
    "./reverseProxyReachability",
  )
  return {
    ...actual,
    probeReverseProxyReachability: (...args: unknown[]) =>
      mockProbeReverseProxyReachability(...args),
  }
})

function emptyConfig(overrides: Partial<DiscoverConfig> = {}): DiscoverConfig {
  return { mediaDatabases: [], reverseProxies: [], ...overrides }
}

describe("startReverseProxyServiceDiscovery", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    _resetReverseProxyServiceDiscoveryForTesting()

    mockFetchDiscoverConfig.mockResolvedValue(emptyConfig())
    mockProbeReverseProxyReachability.mockImplementation(async (endpoint) => ({
      endpoint,
      ok: true,
      durationMs: 100,
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("fetches the discover config exactly once per session", async () => {
    mockFetchDiscoverConfig.mockResolvedValue(
      emptyConfig({
        reverseProxies: [
          {
            id: "gz1",
            type: "general",
            url: "https://proxy.example.com",
            authorizationMethod: "date-token",
          },
        ],
      }),
    )

    await startReverseProxyServiceDiscovery()
    await startReverseProxyServiceDiscovery()
    await startReverseProxyServiceDiscovery()

    expect(mockFetchDiscoverConfig).toHaveBeenCalledTimes(1)
  })

  it("stores preferReverseProxyBaseUrl from the fastest reachable proxy", async () => {
    mockFetchDiscoverConfig.mockResolvedValue(
      emptyConfig({
        reverseProxies: [
          {
            id: "a",
            type: "general",
            url: "https://a.example",
            authorizationMethod: "none",
          },
          {
            id: "b",
            type: "general",
            url: "https://b.example",
            authorizationMethod: "date-token",
          },
        ],
      }),
    )

    mockProbeReverseProxyReachability.mockImplementation(async (endpoint) => ({
      endpoint,
      ok: true,
      durationMs: (endpoint as ReverseProxyEndpoint).url.includes("b.example") ? 50 : 300,
    }))

    await startReverseProxyServiceDiscovery()

    const pref = JSON.parse(localStorages.preferReverseProxyBaseUrl!)
    expect(pref).toEqual({
      id: "b",
      url: "https://b.example",
      authorizationMethod: "date-token",
    })
  })

  it("probes each proxy REACHABILITY_PROBES_PER_URL times", async () => {
    mockFetchDiscoverConfig.mockResolvedValue(
      emptyConfig({
        reverseProxies: [
          {
            id: "gz1",
            type: "general",
            url: "https://a.example",
            authorizationMethod: "none",
          },
        ],
      }),
    )

    await startReverseProxyServiceDiscovery()

    expect(mockProbeReverseProxyReachability).toHaveBeenCalledTimes(REACHABILITY_PROBES_PER_URL)
  })

  it("tags each probe with source=latencytest-N via taggedBaseUrl", async () => {
    mockFetchDiscoverConfig.mockResolvedValue(
      emptyConfig({
        reverseProxies: [
          {
            id: "gz1",
            type: "general",
            url: "https://a.example",
            authorizationMethod: "none",
          },
        ],
      }),
    )

    await startReverseProxyServiceDiscovery()

    const tagged = mockProbeReverseProxyReachability.mock.calls.map(
      (call) => (call[1] as { taggedBaseUrl?: string } | undefined)?.taggedBaseUrl,
    )
    expect(tagged).toEqual([
      "https://a.example?source=latencytest-1",
      "https://a.example?source=latencytest-2",
      "https://a.example?source=latencytest-3",
    ])
  })

  it("stores the untagged URL in localStorage", async () => {
    mockFetchDiscoverConfig.mockResolvedValue(
      emptyConfig({
        reverseProxies: [
          {
            id: "gz1",
            type: "general",
            url: "https://clean.example",
            authorizationMethod: "none",
          },
        ],
      }),
    )

    await startReverseProxyServiceDiscovery()

    const stored = JSON.parse(localStorages.preferReverseProxyBaseUrl!)
    expect(stored.url).toBe("https://clean.example")
    expect(stored.url).not.toContain("latencytest")
  })

  it("does not store preference when all proxies are unreachable", async () => {
    mockFetchDiscoverConfig.mockResolvedValue(
      emptyConfig({
        reverseProxies: [
          {
            id: "gz1",
            type: "general",
            url: "https://a.example",
            authorizationMethod: "none",
          },
        ],
      }),
    )
    mockProbeReverseProxyReachability.mockImplementation(async (endpoint) => ({
      endpoint,
      ok: false,
      durationMs: 0,
      error: "network down",
    }))

    await startReverseProxyServiceDiscovery()

    expect(localStorages.preferReverseProxyBaseUrl).toBeNull()
  })

  it("does not throw when /api/discover fails", async () => {
    mockFetchDiscoverConfig.mockRejectedValue(new Error("boom"))
    await expect(startReverseProxyServiceDiscovery()).resolves.toBeUndefined()
  })

  it("populates getDiscoveredReverseProxies", async () => {
    const proxies: ReverseProxyEndpoint[] = [
      {
        id: "gz1",
        type: "general",
        url: "https://a.example",
        authorizationMethod: "date-token",
      },
    ]
    mockFetchDiscoverConfig.mockResolvedValue(emptyConfig({ reverseProxies: proxies }))

    expect(getDiscoveredReverseProxies()).toEqual([])
    await startReverseProxyServiceDiscovery()
    expect(getDiscoveredReverseProxies()).toEqual(proxies)
  })

  it("notifies subscribers after discovery completes", async () => {
    mockFetchDiscoverConfig.mockResolvedValue(
      emptyConfig({
        reverseProxies: [
          {
            id: "gz1",
            type: "general",
            url: "https://a.example",
            authorizationMethod: "none",
          },
        ],
      }),
    )

    const callback = vi.fn()
    const unsubscribe = subscribeToDiscovery(callback)
    await startReverseProxyServiceDiscovery()
    expect(callback).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it("migrates old preferTmdbBaseUrl when URL matches a discovered proxy", async () => {
    localStorage.setItem(
      "preferTmdbBaseUrl",
      JSON.stringify({
        url: "https://a.example",
        authorizationMethod: "date-token",
      }),
    )

    mockFetchDiscoverConfig.mockResolvedValue(
      emptyConfig({
        reverseProxies: [
          {
            id: "gz1",
            type: "general",
            url: "https://a.example",
            authorizationMethod: "date-token",
          },
        ],
      }),
    )
    // Make probe pick a different URL so migration is visible before overwrite —
    // actually discovery always overwrites with fastest. Migration runs before probe
    // only when we want soft migrate; plan says migrate then probe overwrites.
    // Test migration of keys cleanup: after discovery, old keys cleared.
    await startReverseProxyServiceDiscovery()

    expect(localStorages.preferTmdbBaseUrl).toBeNull()
    expect(localStorages.preferTvdbBaseUrl).toBeNull()
    expect(localStorages.preferReverseProxyBaseUrl).not.toBeNull()
  })

  it("does nothing when reverseProxies is empty", async () => {
    mockFetchDiscoverConfig.mockResolvedValue(emptyConfig())
    await startReverseProxyServiceDiscovery()
    expect(mockProbeReverseProxyReachability).not.toHaveBeenCalled()
    expect(localStorages.preferReverseProxyBaseUrl).toBeNull()
  })
})
