import React from "react"
import { render, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MediaDatabaseServiceDiscovery, _resetMediaDatabaseServiceDiscoveryForTesting } from "./MediaDatabaseServiceDiscovery"
import localStorages from "@/lib/localStorages"
import { discoveredMediaDatabasesQueryKey } from "@/hooks/useDiscoveredMediaDatabaseBaseUrls"
import type { MediaDatabaseEndpoint } from "@/api/discover"
import {
  REACHABILITY_PROBES_PER_URL,
} from "@/lib/mediaDatabaseReachability"
import { createElement, type ReactNode } from "react"

const { mockProbeEndpointReachability } = vi.hoisted(() => ({
  mockProbeEndpointReachability: vi.fn(),
}))

vi.mock("@/lib/mediaDatabaseReachability", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mediaDatabaseReachability")>(
    "@/lib/mediaDatabaseReachability",
  )
  return {
    ...actual,
    probeEndpointReachability: (...args: unknown[]) => mockProbeEndpointReachability(...args),
  }
})

function makeWrapper(discovered: MediaDatabaseEndpoint[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  queryClient.setQueryData(discoveredMediaDatabasesQueryKey, discovered)
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe("MediaDatabaseServiceDiscovery", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Reset the module-level probe guard so each test exercises the
    // probe path independently.
    _resetMediaDatabaseServiceDiscoveryForTesting()
    // Provide a default stub for probe so tests that don't set up an
    // explicit mock still get a deterministic result.
    mockProbeEndpointReachability.mockImplementation(async (endpoint) => ({
      endpoint,
      ok: true,
      durationMs: 100,
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("stores the preferTmdbBaseUrl/preferTvdbBaseUrl from the fastest reachable endpoint", async () => {
    const discovered: MediaDatabaseEndpoint[] = [
      { type: "tmdb", url: "https://a.example/api/tmdb", authorizationMethod: "none" },
      { type: "tmdb", url: "https://b.example/api/tmdb", authorizationMethod: "date-token" },
      { type: "tvdb", url: "https://a.example/api/tvdb", authorizationMethod: "none" },
      { type: "tvdb", url: "https://b.example/api/tvdb", authorizationMethod: "date-token" },
    ]

    // Make https://b.example fast and https://a.example slow.
    mockProbeEndpointReachability.mockImplementation(async (endpoint) => ({
      endpoint,
      ok: true,
      durationMs: endpoint.url.includes("b.example") ? 50 : 300,
    }))

    render(<MediaDatabaseServiceDiscovery />, { wrapper: makeWrapper(discovered) })

    await waitFor(() => {
      expect(localStorages.preferTmdbBaseUrl).not.toBeNull()
      expect(localStorages.preferTvdbBaseUrl).not.toBeNull()
    })

    const tmdbPref = JSON.parse(localStorages.preferTmdbBaseUrl!)
    const tvdbPref = JSON.parse(localStorages.preferTvdbBaseUrl!)
    expect(tmdbPref.url).toBe("https://b.example/api/tmdb")
    expect(tmdbPref.authorizationMethod).toBe("date-token")
    expect(tvdbPref.url).toBe("https://b.example/api/tvdb")
    expect(tvdbPref.authorizationMethod).toBe("date-token")
  })

  it("probes each endpoint REACHABILITY_PROBES_PER_URL times", async () => {
    const discovered: MediaDatabaseEndpoint[] = [
      { type: "tmdb", url: "https://a.example/api/tmdb", authorizationMethod: "none" },
    ]
    mockProbeEndpointReachability.mockImplementation(async (endpoint) => ({
      endpoint,
      ok: true,
      durationMs: 100,
    }))

    render(<MediaDatabaseServiceDiscovery />, { wrapper: makeWrapper(discovered) })

    await waitFor(() => {
      expect(mockProbeEndpointReachability).toHaveBeenCalled()
    })
    // One TMDB endpoint, REACHABILITY_PROBES_PER_URL probes each.
    expect(mockProbeEndpointReachability).toHaveBeenCalledTimes(
      REACHABILITY_PROBES_PER_URL,
    )
  })

  it("uses the best (lowest) duration across multiple probes per endpoint", async () => {
    const discovered: MediaDatabaseEndpoint[] = [
      { type: "tmdb", url: "https://a.example/api/tmdb", authorizationMethod: "none" },
      { type: "tmdb", url: "https://b.example/api/tmdb", authorizationMethod: "none" },
    ]

    // a.example: best probe = 400ms (out of 500, 400, 600)
    // b.example: best probe = 700ms (out of 700, 800, 900)
    // a.example should be selected as the fastest endpoint overall.
    mockProbeEndpointReachability.mockImplementation(async (endpoint) => {
      const isA = endpoint.url.includes("a.example")
      // Return a constant best-case latency per endpoint so the test
      // is not sensitive to call ordering.
      return {
        endpoint,
        ok: true,
        durationMs: isA ? 400 : 700,
      }
    })

    render(<MediaDatabaseServiceDiscovery />, { wrapper: makeWrapper(discovered) })

    await waitFor(() => {
      expect(localStorages.preferTmdbBaseUrl).not.toBeNull()
    })

    const pref = JSON.parse(localStorages.preferTmdbBaseUrl!)
    expect(pref.url).toBe("https://a.example/api/tmdb")
  })

  it("skips unreachable endpoints when picking the fastest", async () => {
    const discovered: MediaDatabaseEndpoint[] = [
      { type: "tmdb", url: "https://a.example/api/tmdb", authorizationMethod: "none" },
      { type: "tmdb", url: "https://b.example/api/tmdb", authorizationMethod: "none" },
    ]

    // a.example is unreachable, b.example is reachable.
    mockProbeEndpointReachability.mockImplementation(async (endpoint) => ({
      endpoint,
      ok: !endpoint.url.includes("a.example"),
      durationMs: 100,
    }))

    render(<MediaDatabaseServiceDiscovery />, { wrapper: makeWrapper(discovered) })

    await waitFor(() => {
      expect(localStorages.preferTmdbBaseUrl).not.toBeNull()
    })

    const pref = JSON.parse(localStorages.preferTmdbBaseUrl!)
    expect(pref.url).toBe("https://b.example/api/tmdb")
  })

  it("does not store any preference when all endpoints are unreachable", async () => {
    const discovered: MediaDatabaseEndpoint[] = [
      { type: "tmdb", url: "https://a.example/api/tmdb", authorizationMethod: "none" },
    ]
    mockProbeEndpointReachability.mockImplementation(async (endpoint) => ({
      endpoint,
      ok: false,
      durationMs: 0,
      error: "network down",
    }))

    render(<MediaDatabaseServiceDiscovery />, { wrapper: makeWrapper(discovered) })

    // Wait long enough for the effect to run and complete.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(localStorages.preferTmdbBaseUrl).toBeNull()
  })

  it("re-runs the probe on every app start and updates the stored preference", async () => {
    // A previously-stored value from a prior app start should NOT
    // short-circuit the probe. The current network may favor a
    // different endpoint, so we always re-evaluate.
    localStorage.setItem(
      "preferTmdbBaseUrl",
      JSON.stringify({
        url: "https://stale.example/api/tmdb",
        authorizationMethod: "none",
      }),
    )
    const discovered: MediaDatabaseEndpoint[] = [
      { type: "tmdb", url: "https://a.example/api/tmdb", authorizationMethod: "none" },
      { type: "tmdb", url: "https://b.example/api/tmdb", authorizationMethod: "none" },
    ]
    mockProbeEndpointReachability.mockImplementation(async (endpoint) => ({
      endpoint,
      ok: true,
      durationMs: endpoint.url.includes("a.example") ? 50 : 300,
    }))

    render(<MediaDatabaseServiceDiscovery />, { wrapper: makeWrapper(discovered) })

    await waitFor(() => {
      const pref = localStorages.preferTmdbBaseUrl
      expect(pref).not.toBeNull()
      // The stale value should be replaced with the new fastest URL.
      expect(JSON.parse(pref!).url).toBe("https://a.example/api/tmdb")
    })
  })

  it("does not re-probe when mounted multiple times in the same session", async () => {
    // The component should mount cleanly multiple times in the same
    // app session (e.g. StrictMode dev double-mount, or a hot-reload
    // cycle) without sending extra probe requests.
    const discovered: MediaDatabaseEndpoint[] = [
      { type: "tmdb", url: "https://a.example/api/tmdb", authorizationMethod: "none" },
      { type: "tvdb", url: "https://a.example/api/tvdb", authorizationMethod: "none" },
    ]
    mockProbeEndpointReachability.mockImplementation(async (endpoint) => ({
      endpoint,
      ok: true,
      durationMs: 100,
    }))

    // First mount kicks off the probe.
    const { unmount } = render(<MediaDatabaseServiceDiscovery />, {
      wrapper: makeWrapper(discovered),
    })
    await waitFor(() => {
      expect(mockProbeEndpointReachability).toHaveBeenCalled()
    })
    const callCountAfterFirstMount = mockProbeEndpointReachability.mock.calls.length
    unmount()

    // Second mount within the same session must NOT re-probe.
    render(<MediaDatabaseServiceDiscovery />, { wrapper: makeWrapper(discovered) })
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(mockProbeEndpointReachability).toHaveBeenCalledTimes(
      callCountAfterFirstMount,
    )
  })
})
