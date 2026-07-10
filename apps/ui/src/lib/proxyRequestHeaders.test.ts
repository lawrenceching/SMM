import { describe, expect, it, vi } from "vitest"
import {
  buildGeneralProxyRequestHeaders,
  buildLocalProxyRequestHeaders,
} from "./proxyRequestHeaders"

vi.mock("./openrestyDateToken", () => ({
  openrestyDateToken: () => "20240507",
}))

describe("buildLocalProxyRequestHeaders", () => {
  it("builds local SMM headers", () => {
    expect(
      buildLocalProxyRequestHeaders({
        upstreamBaseURL: "https://mediadb.vercel.app/api/tmdb",
      }),
    ).toEqual({
      Accept: "application/json",
      "X-SMM-Proxy-Upstream-BaseURL": "https://mediadb.vercel.app/api/tmdb",
    })
  })
})

describe("buildGeneralProxyRequestHeaders", () => {
  it("builds general proxy headers with X-Upstream-Base-Url and date-token", () => {
    expect(
      buildGeneralProxyRequestHeaders({
        upstreamBaseURL: "https://mediadb.vercel.app/api/tmdb",
        authorizationMethod: "date-token",
      }),
    ).toEqual({
      Accept: "application/json",
      "X-Upstream-Base-Url": "https://mediadb.vercel.app/api/tmdb",
      "X-Proxy-Authorization": "Bearer 20240507",
    })
  })

  it("omits X-Proxy-Authorization when auth is none", () => {
    const h = buildGeneralProxyRequestHeaders({
      upstreamBaseURL: "https://mediadb.vercel.app/api/tvdb",
      authorizationMethod: "none",
    })
    expect(h["X-Proxy-Authorization"]).toBeUndefined()
    expect(h["X-Upstream-Base-Url"]).toBe("https://mediadb.vercel.app/api/tvdb")
  })

  it("never sets Authorization for date-token", () => {
    const h = buildGeneralProxyRequestHeaders({
      upstreamBaseURL: "https://example.com",
      authorizationMethod: "date-token",
    })
    expect(h.Authorization).toBeUndefined()
  })
})
