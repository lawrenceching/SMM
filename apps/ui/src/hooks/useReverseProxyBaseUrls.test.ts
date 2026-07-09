import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useReverseProxyBaseUrls } from "./useReverseProxyBaseUrls"
import type { ReverseProxyEndpoint } from "@/api/discover"

const {
  mockGetDiscoveredReverseProxies,
  mockSubscribeToDiscovery,
  mockUseConfig,
} = vi.hoisted(() => ({
  mockGetDiscoveredReverseProxies: vi.fn<() => ReverseProxyEndpoint[]>(() => []),
  mockSubscribeToDiscovery: vi.fn<(cb: () => void) => () => void>(() => () => {}),
  mockUseConfig: vi.fn(() => ({
    appConfig: { version: "1", reverseProxyUrl: null as string | null },
  })),
}))

vi.mock("@/lib/reverseProxyServiceDiscovery", () => ({
  getDiscoveredReverseProxies: () => mockGetDiscoveredReverseProxies(),
  subscribeToDiscovery: (cb: () => void) => mockSubscribeToDiscovery(cb),
}))

vi.mock("@/hooks/userConfig", () => ({
  useConfig: () => mockUseConfig(),
}))

describe("useReverseProxyBaseUrls", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockGetDiscoveredReverseProxies.mockReturnValue([])
    mockSubscribeToDiscovery.mockImplementation(() => () => {})
    mockUseConfig.mockReturnValue({
      appConfig: { version: "1", reverseProxyUrl: null },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns empty list when no local and no discovered proxies", () => {
    const { result } = renderHook(() => useReverseProxyBaseUrls())
    expect(result.current).toEqual([])
  })

  it("puts local reverse proxy first when available", () => {
    mockUseConfig.mockReturnValue({
      appConfig: { version: "1", reverseProxyUrl: "http://127.0.0.1:30005" },
    })
    mockGetDiscoveredReverseProxies.mockReturnValue([
      {
        id: "gz1",
        type: "general",
        url: "https://remote.example",
        authorizationMethod: "date-token",
      },
    ])

    const { result } = renderHook(() => useReverseProxyBaseUrls())

    expect(result.current[0]).toEqual({
      id: "local",
      kind: "local",
      url: "http://127.0.0.1:30005",
      authorizationMethod: "none",
    })
    expect(result.current[1]?.url).toBe("https://remote.example")
    expect(result.current[1]?.kind).toBe("openresty")
  })

  it("prefers localStorage preferred remote before other remotes", () => {
    localStorage.setItem(
      "preferReverseProxyBaseUrl",
      JSON.stringify({
        id: "b",
        url: "https://b.example",
        authorizationMethod: "date-token",
      }),
    )
    mockGetDiscoveredReverseProxies.mockReturnValue([
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
    ])

    const { result } = renderHook(() => useReverseProxyBaseUrls())

    expect(result.current.map((c) => c.url)).toEqual([
      "https://b.example",
      "https://a.example",
    ])
  })

  it("deduplicates by URL", () => {
    mockUseConfig.mockReturnValue({
      appConfig: { version: "1", reverseProxyUrl: "https://same.example" },
    })
    mockGetDiscoveredReverseProxies.mockReturnValue([
      {
        id: "gz1",
        type: "general",
        url: "https://same.example",
        authorizationMethod: "date-token",
      },
    ])

    const { result } = renderHook(() => useReverseProxyBaseUrls())
    expect(result.current).toHaveLength(1)
    expect(result.current[0]?.kind).toBe("local")
  })

  it("omits blank local reverseProxyUrl", () => {
    mockUseConfig.mockReturnValue({
      appConfig: { version: "1", reverseProxyUrl: "   " },
    })
    const { result } = renderHook(() => useReverseProxyBaseUrls())
    expect(result.current).toEqual([])
  })

  it("does not issue any HTTP request of its own", () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    mockGetDiscoveredReverseProxies.mockReturnValue([
      {
        id: "gz1",
        type: "general",
        url: "https://a.example",
        authorizationMethod: "none",
      },
    ])

    renderHook(() => useReverseProxyBaseUrls())
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
