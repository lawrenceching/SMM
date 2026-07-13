import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DiscoverConfig } from "@/api/discover"
import staticConfig from "@/api/staticConfig"
import { fetchWithFailover, getDomainName } from "./http"
import localStorages from "./localStorages"

function okResponse(body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, statusText: "OK" })
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

const HOST_A = "https://tmdb-a.example/api/tmdb"
const HOST_B = "https://tmdb-b.example/api/tmdb"
const PROXY_A = "https://proxy-a.example"
const PROXY_B = "https://proxy-b.example"

function configWith(
  reverseProxies: DiscoverConfig["reverseProxies"],
): DiscoverConfig {
  return { mediaDatabases: [], reverseProxies }
}

beforeEach(() => {
  vi.restoreAllMocks()
  localStorages.disabledDomains = new Set()
})

afterEach(() => {
  localStorages.disabledDomains = new Set()
  vi.useRealTimers()
})

describe("getDomainName", () => {
  it("returns hostname from a valid https URL", () => {
    expect(getDomainName("https://api.themoviedb.org/3/search")).toBe("api.themoviedb.org")
  })

  it("returns hostname from a valid http URL", () => {
    expect(getDomainName("http://example.com/path")).toBe("example.com")
  })

  it("returns hostname without port", () => {
    expect(getDomainName("https://localhost:8080/api")).toBe("localhost")
  })

  it("returns empty string for an invalid URL", () => {
    expect(getDomainName("not-a-url")).toBe("")
  })

  it("returns empty string for an empty string", () => {
    expect(getDomainName("")).toBe("")
  })
})

describe("fetchWithFailover", () => {
  describe("direct success", () => {
    it("calls the first reverse proxy with headers and returns its response", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse({ ok: true }))

      const resp = await fetchWithFailover([HOST_A, HOST_B], "/search/tv", {
        _config: configWith([
          {
            id: "proxy-a",
            type: "general",
            url: PROXY_A,
            authorizationMethod: "date-token",
          },
        ]),
      })

      expect(resp!.ok).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy.mock.calls[0]![0]).toBe(PROXY_A)
      expect(headersOf(fetchSpy.mock.calls[0]![1])["X-Upstream-Base-Url"]).toBe(HOST_A)
    })
  })

  describe("failover order", () => {
    it("tries every reverse proxy before any direct base URL", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(okResponse())

      await fetchWithFailover([HOST_A, HOST_B], "/search/tv", {
        _config: configWith([
          {
            id: "proxy-a",
            type: "general",
            url: PROXY_A,
            authorizationMethod: "none",
          },
        ]),
      })

      expect(fetchSpy).toHaveBeenCalledTimes(3)
      expect(fetchSpy.mock.calls[0]![0]).toBe(PROXY_A)
      expect(fetchSpy.mock.calls[1]![0]).toBe(`${HOST_A}/search/tv`)
      expect(fetchSpy.mock.calls[2]![0]).toBe(`${HOST_B}/search/tv`)
    })

    it("fails over to a reverse proxy with upstream and date-token headers", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(okResponse({ results: [] }))

      const resp = await fetchWithFailover([HOST_A], "/search/movie", {
        _config: configWith([
          {
            id: "proxy-a",
            type: "general",
            url: PROXY_A,
            authorizationMethod: "date-token",
          },
        ]),
      })

      expect(resp!.ok).toBe(true)
      expect(fetchSpy.mock.calls[0]![0]).toBe(PROXY_A)
      expect(fetchSpy.mock.calls[0]![1]).toMatchObject({ method: "GET" })
      const headers = headersOf(fetchSpy.mock.calls[0]![1])
      expect(headers["X-Upstream-Base-Url"]).toBe(HOST_A)
      expect(headers["X-Proxy-Authorization"]).toMatch(/^Bearer \d{8}$/)
    })

    it("omits X-Proxy-Authorization when proxy auth method is none", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(okResponse())

      await fetchWithFailover([HOST_A], "/search/tv", {
        _config: configWith([
          {
            id: "proxy-a",
            type: "general",
            url: PROXY_A,
            authorizationMethod: "none",
          },
        ]),
      })

      const headers = headersOf(fetchSpy.mock.calls[0]![1])
      expect(headers["X-Upstream-Base-Url"]).toBe(HOST_A)
      expect(headers["X-Proxy-Authorization"]).toBeUndefined()
    })

    it("pairs proxies with hosts via zip (shortest list wins)", async () => {
      // 2 hosts + 1 proxy → 1 proxy attempt (paired with HOST_A) + 2 direct attempts
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new TypeError("Failed to fetch"))

      await fetchWithFailover([HOST_A, HOST_B], "/x", {
        _config: configWith([
          {
            id: "proxy-a",
            type: "general",
            url: PROXY_A,
            authorizationMethod: "none",
          },
        ]),
      })

      expect(fetchSpy).toHaveBeenCalledTimes(3)
      expect(fetchSpy.mock.calls.map((c) => c[0])).toEqual([
        PROXY_A,
        `${HOST_A}/x`,
        `${HOST_B}/x`,
      ])
      expect(headersOf(fetchSpy.mock.calls[0]![1])["X-Upstream-Base-Url"]).toBe(HOST_A)
    })
  })

  describe("disabled domain filtering", () => {
    it("skips a disabled base URL and uses the next host via proxy", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse())

      await fetchWithFailover([HOST_A, HOST_B], "/search/tv", {
        _disabledDomains: new Set(["tmdb-a.example"]),
        _config: configWith([
          {
            id: "proxy-a",
            type: "general",
            url: PROXY_A,
            authorizationMethod: "none",
          },
        ]),
      })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy.mock.calls[0]![0]).toBe(PROXY_A)
      expect(headersOf(fetchSpy.mock.calls[0]![1])["X-Upstream-Base-Url"]).toBe(HOST_B)
    })

    it("retries all base URLs when every host is disabled (network-issue heuristic)", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse())

      await fetchWithFailover([HOST_A], "/search/tv", {
        _disabledDomains: new Set(["tmdb-a.example"]),
        _config: configWith([
          {
            id: "proxy-a",
            type: "general",
            url: PROXY_A,
            authorizationMethod: "none",
          },
        ]),
      })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy.mock.calls[0]![0]).toBe(PROXY_A)
    })

    it("skips a disabled reverse proxy and uses the next one", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(okResponse())

      await fetchWithFailover([HOST_A], "/search/tv", {
        _disabledDomains: new Set(["proxy-a.example"]),
        _config: configWith([
          {
            id: "proxy-a",
            type: "general",
            url: PROXY_A,
            authorizationMethod: "none",
          },
          {
            id: "proxy-b",
            type: "general",
            url: PROXY_B,
            authorizationMethod: "none",
          },
        ]),
      })

      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(fetchSpy.mock.calls[0]![0]).toBe(PROXY_B)
      expect(fetchSpy.mock.calls[1]![0]).toBe(`${HOST_A}/search/tv`)
    })
  })

  describe("default / invalid reverse proxies", () => {
    it("uses staticConfig default reverse proxy when discover list is empty", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(okResponse())

      await fetchWithFailover([HOST_A], "/search/tv", {
        _config: configWith([]),
      })

      expect(fetchSpy.mock.calls[0]![0]).toBe(staticConfig.defaultExternalReverseProxy.url)
      const headers = headersOf(fetchSpy.mock.calls[0]![1])
      expect(headers["X-Upstream-Base-Url"]).toBe(HOST_A)
      expect(headers["X-Proxy-Authorization"]).toMatch(/^Bearer \d{8}$/)
    })

    it("filters out unparseable reverse proxy URLs before building the chain", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(okResponse())

      await fetchWithFailover([HOST_A], "/search/tv", {
        _config: configWith([
          {
            id: "bad",
            type: "general",
            url: "not-a-url",
            authorizationMethod: "none",
          },
          {
            id: "good",
            type: "general",
            url: PROXY_B,
            authorizationMethod: "none",
          },
        ]),
      })

      expect(fetchSpy.mock.calls[0]![0]).toBe(PROXY_B)
    })
  })

  describe("abort handling", () => {
    it("forwards AbortSignal to proxy and direct fetch attempts", async () => {
      const controller = new AbortController()
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(okResponse())

      await fetchWithFailover([HOST_A], "/search/tv", {
        signal: controller.signal,
        _config: configWith([
          {
            id: "proxy-a",
            type: "general",
            url: PROXY_A,
            authorizationMethod: "none",
          },
        ]),
      })

      expect(fetchSpy.mock.calls[0]![1]).toMatchObject({ signal: controller.signal })
      expect(fetchSpy.mock.calls[1]![1]).toMatchObject({ signal: controller.signal })
    })

    it("rethrows AbortError without failing over or disabling domains", async () => {
      const abortError = new DOMException("aborted", "AbortError")
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(abortError)

      await expect(
        fetchWithFailover([HOST_A], "/search/tv", {
          _config: configWith([
            {
              id: "proxy-a",
              type: "general",
              url: PROXY_A,
              authorizationMethod: "none",
            },
          ]),
        }),
      ).rejects.toThrow(abortError)

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(localStorages.disabledDomains.size).toBe(0)
    })
  })

  describe("disabled domain bookkeeping", () => {
    it("records a failed proxy in localStorages.disabledDomains before failover to direct", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(okResponse())

      await fetchWithFailover([HOST_A], "/search/tv", {
        _config: configWith([
          {
            id: "proxy-a",
            type: "general",
            url: PROXY_A,
            authorizationMethod: "none",
          },
        ]),
      })

      expect(localStorages.disabledDomains.has("proxy-a.example")).toBe(true)
    })

    it("records a failed reverse proxy when a later direct attempt succeeds", async () => {
      // Chain: PROXY_A(with A), PROXY_B(with B), HOST_A, HOST_B
      vi.spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(okResponse())

      await fetchWithFailover([HOST_A, HOST_B], "/search/tv", {
        _config: configWith([
          {
            id: "proxy-a",
            type: "general",
            url: PROXY_A,
            authorizationMethod: "none",
          },
          {
            id: "proxy-b",
            type: "general",
            url: PROXY_B,
            authorizationMethod: "none",
          },
        ]),
      })

      expect(localStorages.disabledDomains.has("proxy-a.example")).toBe(true)
      expect(localStorages.disabledDomains.has("proxy-b.example")).toBe(true)
      expect(localStorages.disabledDomains.has("tmdb-a.example")).toBe(true)
    })

    it("clears host and proxy domains from disabledDomains when every attempt fails", async () => {
      localStorages.disabledDomains = new Set([
        "tmdb-a.example",
        "proxy-a.example",
        "unrelated.example",
      ])
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"))

      const resp = await fetchWithFailover([HOST_A], "/search/tv", {
        // empty in-memory set so this attempt still tries the candidates
        _disabledDomains: new Set(),
        _config: configWith([
          {
            id: "proxy-a",
            type: "general",
            url: PROXY_A,
            authorizationMethod: "none",
          },
        ]),
      })

      expect(resp).toBeUndefined()
      expect([...localStorages.disabledDomains]).toEqual(["unrelated.example"])
    })
  })

  describe("empty chain", () => {
    it("throws Empty Request Chain when baseUrls is empty", async () => {
      await expect(
        fetchWithFailover([], "/search/tv", {
          _config: configWith([
            {
              id: "proxy-a",
              type: "general",
              url: PROXY_A,
              authorizationMethod: "none",
            },
          ]),
        }),
      ).rejects.toThrow("Empty Request Chain")
    })
  })
})
