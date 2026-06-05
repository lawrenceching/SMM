import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  getDiscoveredEndpoints,
  startMediaDatabaseServiceDiscovery,
  subscribeToDiscovery,
  _resetMediaDatabaseServiceDiscoveryForTesting,
} from "./mediaDatabaseServiceDiscovery"
import localStorages from "@/lib/localStorages"
import { REACHABILITY_PROBES_PER_URL } from "./mediaDatabaseReachability"
import type { MediaDatabaseEndpoint } from "@/api/discover"

const { mockFetchDiscoveredMediaDatabases, mockProbeEndpointReachability } = vi.hoisted(
  () => ({
    mockFetchDiscoveredMediaDatabases: vi.fn<() => Promise<MediaDatabaseEndpoint[]>>(),
    mockProbeEndpointReachability: vi.fn(),
  }),
)

vi.mock("@/api/discover", async () => {
  const actual = await vi.importActual<typeof import("@/api/discover")>("@/api/discover")
  return {
    ...actual,
    fetchDiscoveredMediaDatabases: () => mockFetchDiscoveredMediaDatabases(),
  }
})

vi.mock("./mediaDatabaseReachability", async () => {
  const actual = await vi.importActual<typeof import("./mediaDatabaseReachability")>(
    "./mediaDatabaseReachability",
  )
  return {
    ...actual,
    probeEndpointReachability: (...args: unknown[]) =>
      mockProbeEndpointReachability(...args),
  }
})

describe("startMediaDatabaseServiceDiscovery", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    _resetMediaDatabaseServiceDiscoveryForTesting()

    mockFetchDiscoveredMediaDatabases.mockResolvedValue([])
    mockProbeEndpointReachability.mockImplementation(async (endpoint) => ({
      endpoint,
      ok: true,
      durationMs: 100,
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("fetches the discover config exactly once per session", async () => {
    mockFetchDiscoveredMediaDatabases.mockResolvedValue([
      { type: "tmdb", url: "https://a.com/api/tmdb", authorizationMethod: "none" },
    ])

    await startMediaDatabaseServiceDiscovery()
    await startMediaDatabaseServiceDiscovery()
    await startMediaDatabaseServiceDiscovery()

    expect(mockFetchDiscoveredMediaDatabases).toHaveBeenCalledTimes(1)
  })

  it("stores the preferTmdbBaseUrl/preferTvdbBaseUrl from the fastest reachable endpoint", async () => {
    mockFetchDiscoveredMediaDatabases.mockResolvedValue([
      { type: "tmdb", url: "https://a.example/api/tmdb", authorizationMethod: "none" },
      { type: "tmdb", url: "https://b.example/api/tmdb", authorizationMethod: "date-token" },
      { type: "tvdb", url: "https://a.example/api/tvdb", authorizationMethod: "none" },
      { type: "tvdb", url: "https://b.example/api/tvdb", authorizationMethod: "date-token" },
    ])

    mockProbeEndpointReachability.mockImplementation(async (endpoint) => ({
      endpoint,
      ok: true,
      durationMs: endpoint.url.includes("b.example") ? 50 : 300,
    }))

    await startMediaDatabaseServiceDiscovery()

    const tmdbPref = JSON.parse(localStorages.preferTmdbBaseUrl!)
    const tvdbPref = JSON.parse(localStorages.preferTvdbBaseUrl!)
    expect(tmdbPref.url).toBe("https://b.example/api/tmdb")
    expect(tmdbPref.authorizationMethod).toBe("date-token")
    expect(tvdbPref.url).toBe("https://b.example/api/tvdb")
    expect(tvdbPref.authorizationMethod).toBe("date-token")
  })

  it("probes each endpoint REACHABILITY_PROBES_PER_URL times", async () => {
    mockFetchDiscoveredMediaDatabases.mockResolvedValue([
      { type: "tmdb", url: "https://a.example/api/tmdb", authorizationMethod: "none" },
    ])

    await startMediaDatabaseServiceDiscovery()

    expect(mockProbeEndpointReachability).toHaveBeenCalledTimes(
      REACHABILITY_PROBES_PER_URL,
    )
  })

  it("tags each probe with a ?source=latencytest-N query parameter", async () => {
    mockFetchDiscoveredMediaDatabases.mockResolvedValue([
      { type: "tmdb", url: "https://a.example/api/tmdb", authorizationMethod: "none" },
    ])

    await startMediaDatabaseServiceDiscovery()

    const calledEndpoints = mockProbeEndpointReachability.mock.calls.map(
      (call) => (call[0] as MediaDatabaseEndpoint).url,
    )
    // 3 probes of the same URL, each with a distinct `source=latencytest-N`
    // suffix so the multi-probe pattern is identifiable in the network
    // panel and in upstream access logs.
    expect(calledEndpoints).toEqual([
      "https://a.example/api/tmdb?source=latencytest-1",
      "https://a.example/api/tmdb?source=latencytest-2",
      "https://a.example/api/tmdb?source=latencytest-3",
    ])
  })

  it("appends the source parameter with & when the URL already has a query string", async () => {
    mockFetchDiscoveredMediaDatabases.mockResolvedValue([
      {
        type: "tmdb",
        url: "https://a.example/api/tmdb?foo=bar",
        authorizationMethod: "none",
      },
    ])

    await startMediaDatabaseServiceDiscovery()

    const calledEndpoints = mockProbeEndpointReachability.mock.calls.map(
      (call) => (call[0] as MediaDatabaseEndpoint).url,
    )
    expect(calledEndpoints).toEqual([
      "https://a.example/api/tmdb?foo=bar&source=latencytest-1",
      "https://a.example/api/tmdb?foo=bar&source=latencytest-2",
      "https://a.example/api/tmdb?foo=bar&source=latencytest-3",
    ])
  })

  it("stores the untagged (clean) URL in localStorage", async () => {
    mockFetchDiscoveredMediaDatabases.mockResolvedValue([
      { type: "tmdb", url: "https://clean.example/api/tmdb", authorizationMethod: "none" },
    ])

    await startMediaDatabaseServiceDiscovery()

    const stored = JSON.parse(localStorages.preferTmdbBaseUrl!)
    // The localStorage preference must NOT contain the
    // `?source=latencytest-N` suffix — that suffix is only for the
    // probe request, not for the URL that the search code path uses.
    expect(stored.url).toBe("https://clean.example/api/tmdb")
    expect(stored.url).not.toContain("latencytest")
  })

  it("re-runs the probe on every app start and overwrites the stored preference", async () => {
    localStorage.setItem(
      "preferTmdbBaseUrl",
      JSON.stringify({
        url: "https://stale.example/api/tmdb",
        authorizationMethod: "none",
      }),
    )

    mockFetchDiscoveredMediaDatabases.mockResolvedValue([
      { type: "tmdb", url: "https://a.example/api/tmdb", authorizationMethod: "none" },
      { type: "tmdb", url: "https://b.example/api/tmdb", authorizationMethod: "none" },
    ])
    mockProbeEndpointReachability.mockImplementation(async (endpoint) => ({
      endpoint,
      ok: true,
      durationMs: endpoint.url.includes("a.example") ? 50 : 300,
    }))

    await startMediaDatabaseServiceDiscovery()

    const pref = JSON.parse(localStorages.preferTmdbBaseUrl!)
    expect(pref.url).toBe("https://a.example/api/tmdb")
  })

  it("does not store any preference when all endpoints are unreachable", async () => {
    mockFetchDiscoveredMediaDatabases.mockResolvedValue([
      { type: "tmdb", url: "https://a.example/api/tmdb", authorizationMethod: "none" },
    ])
    mockProbeEndpointReachability.mockImplementation(async (endpoint) => ({
      endpoint,
      ok: false,
      durationMs: 0,
      error: "network down",
    }))

    await startMediaDatabaseServiceDiscovery()

    expect(localStorages.preferTmdbBaseUrl).toBeNull()
  })

  it("does not throw when /api/discover fails", async () => {
    mockFetchDiscoveredMediaDatabases.mockRejectedValue(new Error("boom"))

    await expect(startMediaDatabaseServiceDiscovery()).resolves.toBeUndefined()
  })

  it("populates getDiscoveredEndpoints with the fetched list", async () => {
    mockFetchDiscoveredMediaDatabases.mockResolvedValue([
      { type: "tmdb", url: "https://a.com/api/tmdb", authorizationMethod: "none" },
      { type: "tvdb", url: "https://a.com/api/tvdb", authorizationMethod: "none" },
    ])

    expect(getDiscoveredEndpoints()).toEqual([])

    await startMediaDatabaseServiceDiscovery()

    expect(getDiscoveredEndpoints()).toEqual([
      { type: "tmdb", url: "https://a.com/api/tmdb", authorizationMethod: "none" },
      { type: "tvdb", url: "https://a.com/api/tvdb", authorizationMethod: "none" },
    ])
  })

  it("notifies subscribers after the discovery completes", async () => {
    mockFetchDiscoveredMediaDatabases.mockResolvedValue([
      { type: "tmdb", url: "https://a.com/api/tmdb", authorizationMethod: "none" },
    ])

    const callback = vi.fn()
    const unsubscribe = subscribeToDiscovery(callback)

    await startMediaDatabaseServiceDiscovery()
    expect(callback).toHaveBeenCalledTimes(1)

    unsubscribe()
  })

  it("catches and logs subscriber exceptions without aborting others", async () => {
    mockFetchDiscoveredMediaDatabases.mockResolvedValue([
      { type: "tmdb", url: "https://a.com/api/tmdb", authorizationMethod: "none" },
    ])

    const good = vi.fn()
    const bad = vi.fn(() => {
      throw new Error("subscriber failure")
    })
    subscribeToDiscovery(bad)
    subscribeToDiscovery(good)

    await expect(startMediaDatabaseServiceDiscovery()).resolves.toBeUndefined()
    expect(bad).toHaveBeenCalled()
    expect(good).toHaveBeenCalled()
  })

  it("does nothing when the discover list is empty", async () => {
    mockFetchDiscoveredMediaDatabases.mockResolvedValue([])

    await startMediaDatabaseServiceDiscovery()

    expect(mockProbeEndpointReachability).not.toHaveBeenCalled()
    expect(localStorages.preferTmdbBaseUrl).toBeNull()
    expect(localStorages.preferTvdbBaseUrl).toBeNull()
  })
})
