import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { _resetTvdbClientCacheForTesting, getTVDBv4Client } from "./TvdbUtils"

// Use the real TVDBv4 client implementation here so we exercise the login + token-cache
// behavior end-to-end through window.fetch stubs.

const REVERSE_PROXY_URL = "http://127.0.0.1:30005"
const TVDB_DIRECT_UPSTREAM = "https://api4.thetvdb.com/v4"
const SMM_TVDB_DEFAULT_UPSTREAM = "https://tmdb-mcp-server.imlc.me/api/tvdb"

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

beforeEach(() => {
  _resetTvdbClientCacheForTesting()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("TVDB login + token caching through reverse proxy", () => {
  it("performs login through the reverse proxy and reuses the cached token on subsequent calls", async () => {
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

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    const loginCall = fetchSpy.mock.calls[0]
    const seriesCall = fetchSpy.mock.calls[1]

    expect(loginCall[0]).toBe(`${REVERSE_PROXY_URL}/login`)
    const loginInit = loginCall[1] as RequestInit
    expect(loginInit.method).toBe("POST")
    expect(loginInit.body).toBe(JSON.stringify({ apikey: "tvdb-api-key" }))
    const loginHeaders = loginInit.headers as Headers
    expect(loginHeaders.get("X-SMM-Proxy-Upstream-BaseURL")).toBe(TVDB_DIRECT_UPSTREAM)

    expect(seriesCall[0]).toBe(`${REVERSE_PROXY_URL}/series/421069/extended`)
    const seriesInit = seriesCall[1] as RequestInit
    const seriesHeaders = seriesInit.headers as Headers
    expect(seriesHeaders.get("Authorization")).toBe("Bearer TVDB_TOKEN_123")
    expect(seriesHeaders.get("X-SMM-Proxy-Upstream-BaseURL")).toBe(TVDB_DIRECT_UPSTREAM)

    // Second call: must reuse cached token; no second login request.
    await tvdb.seriesExtendedById(99999)
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    const loginCalls = fetchSpy.mock.calls.filter((c) => String(c[0]).endsWith("/login"))
    expect(loginCalls).toHaveLength(1)
    const second = fetchSpy.mock.calls[2]
    const secondHeaders = (second[1] as RequestInit).headers as Headers
    expect(secondHeaders.get("Authorization")).toBe("Bearer TVDB_TOKEN_123")
  })

  it("does not perform login when API key is empty and upstream is the SMM-managed default", async () => {
    const fetchSpy = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(jsonResponse({ status: "success", data: { id: 1 } }))

    const tvdb = getTVDBv4Client({ reverseProxyUrl: REVERSE_PROXY_URL })
    await tvdb.seriesExtendedById(1)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const url = String(fetchSpy.mock.calls[0][0])
    expect(url).toBe(`${REVERSE_PROXY_URL}/series/1/extended`)
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    const headers = init.headers as Headers
    expect(headers.get("Authorization")).toBeNull()
    expect(headers.get("X-SMM-Proxy-Upstream-BaseURL")).toBe(SMM_TVDB_DEFAULT_UPSTREAM)
    // No login was sent.
    const loginCalls = fetchSpy.mock.calls.filter((c) => String(c[0]).endsWith("/login"))
    expect(loginCalls).toHaveLength(0)
  })

  it("does not perform login when configured TVDB host has no API key", async () => {
    const fetchSpy = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(jsonResponse({ status: "success", data: { id: 1 } }))

    const tvdb = getTVDBv4Client({ reverseProxyUrl: REVERSE_PROXY_URL, upstreamBaseURL: TVDB_DIRECT_UPSTREAM })
    await tvdb.seriesExtendedById(1)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    const headers = init.headers as Headers
    expect(headers.get("Authorization")).toBeNull()
    expect(headers.get("X-SMM-Proxy-Upstream-BaseURL")).toBe(TVDB_DIRECT_UPSTREAM)
  })
})
