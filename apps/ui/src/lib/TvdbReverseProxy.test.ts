import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { _resetTvdbClientCacheForTesting, getTVDBv4Client } from "./TvdbUtils"
import { defaultUserConfig, readUserConfig } from "@/api/readUserConfig"
import { fetchDiscoverConfig } from "@/api/discover"
import { _resetInternalReverseProxyCacheForTesting } from "@/api/fetchByInternalReverseProxy"
import { hello } from "@/api/hello"

vi.mock("@/api/readUserConfig", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/readUserConfig")>()
  return {
    ...actual,
    readUserConfig: vi.fn(),
  }
})

vi.mock("@/api/discover", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/discover")>()
  return {
    ...actual,
    fetchDiscoverConfig: vi.fn(),
  }
})

vi.mock("@/api/hello", () => ({
  hello: vi.fn(),
}))

const { mockFetchTvdb } = vi.hoisted(() => ({
  mockFetchTvdb: vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))),
}))

vi.mock("@/api/tvdb", () => ({
  fetchTvdb: mockFetchTvdb,
}))

// Use the real TVDBv4 client implementation here so we exercise the login + token-cache
// behavior end-to-end through window.fetch stubs.

const REVERSE_PROXY_URL = "http://127.0.0.1:30005"
const TVDB_DIRECT_UPSTREAM = "https://api4.thetvdb.com/v4"
const SMM_TVDB_DEFAULT_UPSTREAM = "https://mediadb.vercel.app/api/tvdb"

const mockReadUserConfig = vi.mocked(readUserConfig)
const mockFetchDiscoverConfig = vi.mocked(fetchDiscoverConfig)
const mockHello = vi.mocked(hello)

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

beforeEach(() => {
  vi.clearAllMocks()
  _resetTvdbClientCacheForTesting()
  _resetInternalReverseProxyCacheForTesting()
  mockHello.mockResolvedValue({ reverseProxyUrl: REVERSE_PROXY_URL } as Awaited<ReturnType<typeof hello>>)
  mockReadUserConfig.mockResolvedValue({
    ...defaultUserConfig,
    tvdb: { host: "", apiKey: "", httpProxy: "" },
  })
  mockFetchDiscoverConfig.mockResolvedValue({
    mediaDatabases: [
      {
        type: "tvdb",
        url: SMM_TVDB_DEFAULT_UPSTREAM,
        authorizationMethod: "none",
      },
    ],
    reverseProxies: [],
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("TVDB login + token caching through reverse proxy", () => {
  it("performs login through the reverse proxy and routes post-login calls through fetchTvdb with the cached token", async () => {
    const fetchSpy = vi.spyOn(window, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url ?? String(input)
      if (url.endsWith("/login")) {
        return jsonResponse({ status: "success", data: { token: "TVDB_TOKEN_123" } })
      }
      return jsonResponse({ status: "success", data: { id: 421069 } })
    })

    const tvdb = getTVDBv4Client({
      reverseProxyUrl: REVERSE_PROXY_URL,
      upstreamBaseURL: TVDB_DIRECT_UPSTREAM,
      apiKey: "tvdb-api-key",
    })

    // First call: triggers login + extended request.
    await tvdb.seriesExtendedById(421069)

    // Login call: window.fetch (login path bypasses fetchTvdb).
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const loginCall = fetchSpy.mock.calls[0]
    expect(loginCall[0]).toBe(`${REVERSE_PROXY_URL}/login`)
    const loginInit = loginCall[1] as RequestInit
    expect(loginInit.method).toBe("POST")
    expect(loginInit.body).toBe(JSON.stringify({ apikey: "tvdb-api-key" }))
    const loginHeaders = loginInit.headers as Record<string, string>
    expect(loginHeaders["X-SMM-Proxy-Upstream-BaseURL"]).toBe(TVDB_DIRECT_UPSTREAM)
    expect(loginHeaders["X-Http-Proxy"]).toBeUndefined()

    // Post-login call: routed through fetchTvdb with the extracted JWT.
    expect(mockFetchTvdb).toHaveBeenCalledTimes(1)
    const seriesPath = mockFetchTvdb.mock.calls[0]![0] as string
    expect(seriesPath).toBe("/series/421069/extended")
    expect(mockFetchTvdb.mock.calls[0]![1]).toMatchObject({ jwt: "TVDB_TOKEN_123" })

    // Second call: reuses the cached token (no second login, same JWT).
    await tvdb.seriesExtendedById(99999)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(mockFetchTvdb).toHaveBeenCalledTimes(2)
    expect(mockFetchTvdb.mock.calls[1]![0]).toBe("/series/99999/extended")
    expect(mockFetchTvdb.mock.calls[1]![1]).toMatchObject({ jwt: "TVDB_TOKEN_123" })
  })

  it("sets X-Http-Proxy on TVDB login when user config has httpProxy", async () => {
    mockReadUserConfig.mockResolvedValue({
      ...defaultUserConfig,
      tvdb: {
        host: TVDB_DIRECT_UPSTREAM,
        apiKey: "tvdb-api-key",
        httpProxy: "http://192.168.50.10:7897",
      },
    })

    const fetchSpy = vi.spyOn(window, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url ?? String(input)
      if (url.endsWith("/login")) {
        return jsonResponse({ status: "success", data: { token: "TVDB_TOKEN_123" } })
      }
      return jsonResponse({ status: "success", data: { id: 1 } })
    })

    const tvdb = getTVDBv4Client({
      reverseProxyUrl: REVERSE_PROXY_URL,
      upstreamBaseURL: TVDB_DIRECT_UPSTREAM,
      apiKey: "tvdb-api-key",
    })

    await tvdb.seriesExtendedById(1)

    const loginInit = fetchSpy.mock.calls[0]![1] as RequestInit
    const loginHeaders = loginInit.headers as Record<string, string>
    expect(loginHeaders["X-Http-Proxy"]).toBe("http://192.168.50.10:7897")
    expect(loginHeaders["X-SMM-Proxy-Upstream-BaseURL"]).toBe(TVDB_DIRECT_UPSTREAM)
  })

  it("does not perform login when API key is empty and upstream is the SMM-managed default", async () => {
    const fetchSpy = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(jsonResponse({ status: "success", data: { id: 1 } }))

    const tvdb = getTVDBv4Client({ reverseProxyUrl: REVERSE_PROXY_URL })
    await tvdb.seriesExtendedById(1)

    // SMM-managed default: no login, no JWT, all calls go through fetchTvdb.
    expect(fetchSpy).toHaveBeenCalledTimes(0)
    expect(mockFetchTvdb).toHaveBeenCalledTimes(1)
    expect(mockFetchTvdb.mock.calls[0]![0]).toBe("/series/1/extended")
    // SMM-managed default fetchImpl does not include a `jwt` key (no auth needed).
    expect(mockFetchTvdb.mock.calls[0]![1]).not.toHaveProperty("jwt")
  })

  it("does not perform login when configured TVDB host has no API key", async () => {
    const fetchSpy = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(jsonResponse({ status: "success", data: { id: 1 } }))

    const tvdb = getTVDBv4Client({ reverseProxyUrl: REVERSE_PROXY_URL, upstreamBaseURL: TVDB_DIRECT_UPSTREAM })
    await tvdb.seriesExtendedById(1)

    // Custom upstream without API key: disableAuth=true, no login, no JWT.
    expect(fetchSpy).toHaveBeenCalledTimes(0)
    expect(mockFetchTvdb).toHaveBeenCalledTimes(1)
    expect(mockFetchTvdb.mock.calls[0]![0]).toBe("/series/1/extended")
    expect(mockFetchTvdb.mock.calls[0]![1]).toMatchObject({ jwt: undefined })
  })
})
