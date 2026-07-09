import { describe, expect, it, vi } from "vitest"
import { buildProxyRequestHeaders } from "./proxyRequestHeaders"

vi.mock("./openrestyDateToken", () => ({
  openrestyDateToken: () => "20240507",
}))

describe("buildProxyRequestHeaders", () => {
  it("builds local SMM headers without proxy auth", () => {
    expect(
      buildProxyRequestHeaders({
        kind: "local",
        upstreamBaseURL: "https://tmdb-mcp-server.imlc.me/api/tmdb",
        authorizationMethod: "none",
      }),
    ).toEqual({
      Accept: "application/json",
      "X-SMM-Proxy-Upstream-BaseURL": "https://tmdb-mcp-server.imlc.me/api/tmdb",
    })
  })

  it("builds openresty headers with X-Upstream-Base-Url and date-token", () => {
    expect(
      buildProxyRequestHeaders({
        kind: "openresty",
        upstreamBaseURL: "https://tmdb-mcp-server.imlc.me/api/tmdb",
        authorizationMethod: "date-token",
      }),
    ).toEqual({
      Accept: "application/json",
      "X-Upstream-Base-Url": "https://tmdb-mcp-server.imlc.me/api/tmdb",
      "X-Proxy-Authorization": "Bearer 20240507",
    })
  })

  it("omits X-Proxy-Authorization when openresty auth is none", () => {
    const h = buildProxyRequestHeaders({
      kind: "openresty",
      upstreamBaseURL: "https://tmdb-mcp-server.imlc.me/api/tvdb",
      authorizationMethod: "none",
    })
    expect(h["X-Proxy-Authorization"]).toBeUndefined()
    expect(h["X-Upstream-Base-Url"]).toBe("https://tmdb-mcp-server.imlc.me/api/tvdb")
  })

  it("never sets Authorization for openresty date-token", () => {
    const h = buildProxyRequestHeaders({
      kind: "openresty",
      upstreamBaseURL: "https://example.com",
      authorizationMethod: "date-token",
    })
    expect(h.Authorization).toBeUndefined()
  })
})
