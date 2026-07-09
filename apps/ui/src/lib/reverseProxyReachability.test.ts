import { afterEach, describe, expect, it, vi } from "vitest"
import {
  appendLatencyTestSource,
  pickFastestReverseProxy,
  probeReverseProxyReachability,
  REACHABILITY_PROBES_PER_URL,
} from "./reverseProxyReachability"
import type { ReverseProxyEndpoint } from "@/api/discover"
import { SMM_TMDB_DEFAULT_UPSTREAM } from "@/api/tmdb"

vi.mock("./openrestyDateToken", () => ({
  openrestyDateToken: () => "20240507",
}))

const proxy = (overrides: Partial<ReverseProxyEndpoint> = {}): ReverseProxyEndpoint => ({
  id: "gz1",
  type: "general",
  url: "https://proxy.example.com",
  authorizationMethod: "none",
  ...overrides,
})

describe("REACHABILITY_PROBES_PER_URL", () => {
  it("is 3", () => {
    expect(REACHABILITY_PROBES_PER_URL).toBe(3)
  })
})

describe("appendLatencyTestSource", () => {
  it("appends ?source= when URL has no query", () => {
    expect(appendLatencyTestSource("https://proxy.example.com", 1)).toBe(
      "https://proxy.example.com?source=latencytest-1",
    )
  })

  it("appends &source= when URL already has a query", () => {
    expect(appendLatencyTestSource("https://proxy.example.com?foo=bar", 2)).toBe(
      "https://proxy.example.com?foo=bar&source=latencytest-2",
    )
  })
})

describe("probeReverseProxyReachability", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("GETs /search/tv on the proxy with OpenResty upstream header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal("fetch", fetchMock)

    await probeReverseProxyReachability(proxy())

    const calledUrl = fetchMock.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain("https://proxy.example.com/search/tv?")
    expect(calledUrl).toContain("query=__probe__")
    expect(calledUrl).toContain("language=en-US")

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers["X-Upstream-Base-Url"]).toBe(SMM_TMDB_DEFAULT_UPSTREAM)
    expect(headers["X-SMM-Proxy-Upstream-BaseURL"]).toBeUndefined()
  })

  it("sends X-Proxy-Authorization for date-token proxies", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal("fetch", fetchMock)

    await probeReverseProxyReachability(proxy({ authorizationMethod: "date-token" }))

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers["X-Proxy-Authorization"]).toBe("Bearer 20240507")
    expect(headers.Authorization).toBeUndefined()
  })

  it("returns ok=true even for 4xx responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    const result = await probeReverseProxyReachability(proxy())
    expect(result.ok).toBe(true)
  })

  it("returns ok=false when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))
    const result = await probeReverseProxyReachability(proxy())
    expect(result.ok).toBe(false)
    expect(result.error).toBe("network down")
  })

  it("uses taggedUrl when provided instead of building the probe path on proxy.url", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal("fetch", fetchMock)

    await probeReverseProxyReachability(proxy(), {
      taggedBaseUrl: "https://proxy.example.com?source=latencytest-1",
    })

    const calledUrl = fetchMock.mock.calls[0]?.[0] as string
    expect(calledUrl.startsWith("https://proxy.example.com/search/tv?")).toBe(true)
    expect(calledUrl).toContain("source=latencytest-1")
  })
})

describe("pickFastestReverseProxy", () => {
  it("returns null when none ok", () => {
    expect(
      pickFastestReverseProxy([
        { endpoint: proxy(), ok: false, durationMs: 10 },
      ]),
    ).toBeNull()
  })

  it("returns the fastest ok endpoint", () => {
    const a = proxy({ id: "a", url: "https://a.example" })
    const b = proxy({ id: "b", url: "https://b.example" })
    const fastest = pickFastestReverseProxy([
      { endpoint: a, ok: true, durationMs: 200 },
      { endpoint: b, ok: true, durationMs: 50 },
    ])
    expect(fastest?.id).toBe("b")
  })
})
