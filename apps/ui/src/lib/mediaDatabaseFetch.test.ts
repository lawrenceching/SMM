import { describe, expect, it, vi } from "vitest"
import { mediaDatabaseFetch } from "./mediaDatabaseFetch"
import type { ReverseProxyCandidate } from "@/hooks/useReverseProxyBaseUrls"
import localStorages from "./localStorages"

vi.mock("./openrestyDateToken", () => ({
  openrestyDateToken: () => "20240507",
}))

const DEFAULT_UPSTREAM = "https://mediadb.vercel.app/api/tmdb"
const LOCAL_PROXY = "http://127.0.0.1:30005"
const CUSTOM_UPSTREAM = "https://api.themoviedb.org/3"
const PROXY_A: ReverseProxyCandidate = {
  id: "a",
  url: "https://proxy-a.example",
  authorizationMethod: "date-token",
}

function okResponse(): Response {
  return new Response("{}", { status: 200, statusText: "OK" })
}

function headersOf(init: RequestInit | undefined): Record<string, string> {
  const h = init?.headers
  if (!h) return {}
  if (h instanceof Headers) {
    const out: Record<string, string> = {}
    h.forEach((v, k) => {
      out[k] = v
    })
    return out
  }
  return { ...(h as Record<string, string>) }
}

describe("mediaDatabaseFetch", () => {
  it("calls default upstream directly first without proxy headers", async () => {
    const fetchFn = vi.fn(async () => okResponse())
    await mediaDatabaseFetch(
      {
        path: "/search/tv",
        upstreamBaseUrl: DEFAULT_UPSTREAM,
        defaultUpstreamBaseUrl: DEFAULT_UPSTREAM,
        generalProxies: [PROXY_A],
        fetchFn,
      },
      { method: "GET" },
    )
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(fetchFn.mock.calls[0]![0]).toBe(`${DEFAULT_UPSTREAM}/search/tv`)
    const headers = headersOf(fetchFn.mock.calls[0]![1])
    expect(headers["X-Upstream-Base-Url"]).toBeUndefined()
  })

  it("on direct network failure, retries via general proxy with upstream headers", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(okResponse())

    await mediaDatabaseFetch({
      path: "/search/movie",
      upstreamBaseUrl: DEFAULT_UPSTREAM,
      defaultUpstreamBaseUrl: DEFAULT_UPSTREAM,
      generalProxies: [PROXY_A],
      fetchFn,
    })
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(fetchFn.mock.calls[1]![0]).toBe("https://proxy-a.example/search/movie")
    const headers = headersOf(fetchFn.mock.calls[1]![1])
    expect(headers["X-Upstream-Base-Url"]).toBe(DEFAULT_UPSTREAM)
    expect(headers["X-Proxy-Authorization"]).toBe("Bearer 20240507")
  })

  it("uses local reverse proxy for custom upstream", async () => {
    const fetchFn = vi.fn(async () => okResponse())
    await mediaDatabaseFetch({
      path: "/search/tv",
      upstreamBaseUrl: CUSTOM_UPSTREAM,
      defaultUpstreamBaseUrl: DEFAULT_UPSTREAM,
      localReverseProxyUrl: LOCAL_PROXY,
      fetchFn,
    })
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(fetchFn.mock.calls[0]![0]).toBe(`${LOCAL_PROXY}/search/tv`)
    const headers = headersOf(fetchFn.mock.calls[0]![1])
    expect(headers["X-SMM-Proxy-Upstream-BaseURL"]).toBe(CUSTOM_UPSTREAM)
  })

  it("skips direct when upstream domain is disabled", async () => {
    localStorages.disabledDomains = new Set(["mediadb.vercel.app"])
    const fetchFn = vi.fn(async () => okResponse())
    await mediaDatabaseFetch({
      path: "/search/tv",
      upstreamBaseUrl: DEFAULT_UPSTREAM,
      defaultUpstreamBaseUrl: DEFAULT_UPSTREAM,
      generalProxies: [PROXY_A],
      fetchFn,
    })
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(fetchFn.mock.calls[0]![0]).toBe("https://proxy-a.example/search/tv")
    localStorages.disabledDomains = new Set()
  })

  it("rejects empty upstreamBaseUrl", async () => {
    await expect(
      mediaDatabaseFetch({
        path: "/x",
        upstreamBaseUrl: "   ",
        defaultUpstreamBaseUrl: DEFAULT_UPSTREAM,
        fetchFn: vi.fn(async () => okResponse()),
      }),
    ).rejects.toThrow("mediaDatabaseFetch: upstreamBaseUrl is required")
  })

  it("returns non-OK response when abortOnHttpError is false", async () => {
    const fetchFn = vi.fn(
      async () => new Response("nope", { status: 502, statusText: "Bad Gateway" }),
    )
    const resp = await mediaDatabaseFetch({
      path: "/search/tv",
      upstreamBaseUrl: DEFAULT_UPSTREAM,
      defaultUpstreamBaseUrl: DEFAULT_UPSTREAM,
      abortOnHttpError: false,
      fetchFn,
    })
    expect(resp.status).toBe(502)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
})
