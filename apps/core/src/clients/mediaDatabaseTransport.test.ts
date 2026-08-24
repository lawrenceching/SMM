import { describe, expect, it } from "vitest";
import type { DiscoverPort } from "../ports/DiscoverPort";
import type { HttpResponse, NetworkPort } from "../ports/NetworkPort";
import {
  _resetTvdbTokenCacheForTests,
  fetchMediaDatabase,
  MediaDatabaseFailoverExhaustedError,
} from "./mediaDatabaseTransport";

function jsonOk(body: unknown = {}): HttpResponse {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {},
    text: () => Promise.resolve(JSON.stringify(body)),
    json: <T>() => Promise.resolve(body as T),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  };
}

function jsonFail(status: number): HttpResponse {
  return {
    ok: false,
    status,
    statusText: "ERR",
    headers: {},
    text: () => Promise.resolve(""),
    json: async () => {
      throw new Error("no json");
    },
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  };
}

describe("fetchMediaDatabase", () => {
  it("failovers to the next discover TMDB host when the first throws", async () => {
    const urls: string[] = [];
    const network: NetworkPort = {
      fetch: async (url) => {
        urls.push(url);
        if (url.includes("dead.example")) throw new Error("network down");
        if (url.includes("live.example")) return jsonOk({ results: [] });
        throw new Error("unexpected: " + url);
      },
    };
    const discover: DiscoverPort = {
      getDiscoverConfig: async () => ({
        mediaDatabases: [
          { type: "tmdb", url: "https://dead.example/api/tmdb", authorizationMethod: "none" },
          { type: "tmdb", url: "https://live.example/api/tmdb", authorizationMethod: "none" },
        ],
        reverseProxies: [],
      }),
    };

    const resp = await fetchMediaDatabase(network, {
      kind: "tmdb",
      path: "/search/tv?query=x",
      discover,
    });

    expect(resp.ok).toBe(true);
    expect(urls[0]).toContain("https://dead.example/api/tmdb/search/tv");
    expect(urls[1]).toContain("https://live.example/api/tmdb/search/tv");
  });

  it("routes custom host via local reverse proxy with X-SMM-Proxy-Upstream-BaseURL", async () => {
    const urls: string[] = [];
    const headers: Array<Record<string, string | undefined>> = [];
    const network: NetworkPort = {
      fetch: async (url, init) => {
        urls.push(url);
        headers.push(init?.headers ?? {});
        return jsonOk({});
      },
    };

    await fetchMediaDatabase(network, {
      kind: "tmdb",
      path: "/search/tv?query=x",
      configuredHost: "https://api.themoviedb.org/3",
      reverseProxyUrl: "http://127.0.0.1:30005",
      apiKey: "secret",
    });

    expect(urls[0]).toBe("http://127.0.0.1:30005/search/tv?query=x");
    expect(headers[0]?.["X-SMM-Proxy-Upstream-BaseURL"]).toBe("https://api.themoviedb.org/3");
    expect(headers[0]?.Authorization).toBe("Bearer secret");
  });

  it("throws MediaDatabaseFailoverExhaustedError when every host fails", async () => {
    const network: NetworkPort = {
      fetch: async () => {
        throw new Error("down");
      },
    };
    const discover: DiscoverPort = {
      getDiscoverConfig: async () => ({
        mediaDatabases: [
          { type: "tmdb", url: "https://a.example", authorizationMethod: "none" },
          { type: "tmdb", url: "https://b.example", authorizationMethod: "none" },
        ],
        reverseProxies: [],
      }),
    };

    await expect(
      fetchMediaDatabase(network, {
        kind: "tmdb",
        path: "/search/tv",
        discover,
      }),
    ).rejects.toBeInstanceOf(MediaDatabaseFailoverExhaustedError);
  });

  it("failovers on HTTP non-OK for default upstream hosts", async () => {
    const urls: string[] = [];
    const network: NetworkPort = {
      fetch: async (url) => {
        urls.push(url);
        if (url.includes("a.example")) return jsonFail(502);
        return jsonOk({});
      },
    };
    const discover: DiscoverPort = {
      getDiscoverConfig: async () => ({
        mediaDatabases: [
          { type: "tmdb", url: "https://a.example", authorizationMethod: "none" },
          { type: "tmdb", url: "https://b.example", authorizationMethod: "none" },
        ],
        reverseProxies: [],
      }),
    };

    const resp = await fetchMediaDatabase(network, {
      kind: "tmdb",
      path: "/tv/1",
      discover,
    });
    expect(resp.ok).toBe(true);
    expect(urls).toHaveLength(2);
  });

  it("passes httpProxy to NetworkPort on direct custom-host fetch", async () => {
    const proxies: Array<string | undefined> = [];
    const network: NetworkPort = {
      fetch: async (_url, init) => {
        proxies.push(init?.proxy);
        return jsonOk({ results: [] });
      },
    };

    await fetchMediaDatabase(network, {
      kind: "tmdb",
      path: "/search/tv?query=x",
      configuredHost: "https://tmdb.example.com/v3",
      apiKey: "key",
      httpProxy: "socks5://127.0.0.1:1080",
    });

    expect(proxies[0]).toBe("socks5://127.0.0.1:1080");
  });
});

describe("TVDB custom-host JWT login", () => {
  it("logs in first and uses the JWT as Bearer for a custom TVDB host", async () => {
    const urls: string[] = []
    const headers: Array<Record<string, string | undefined>> = []
    const network: NetworkPort = {
      fetch: async (url, init) => {
        urls.push(url)
        headers.push(init?.headers ?? {})
        if (url.endsWith("/login")) {
          expect(init?.method).toBe("POST")
          expect(JSON.parse(init?.body ?? "{}")).toEqual({ apikey: "secret" })
          return jsonOk({ status: "success", data: { token: "jwt-123" } })
        }
        return jsonOk({ status: "success", data: [{ id: "series-1", name: "My Show" }] })
      },
    }

    const resp = await fetchMediaDatabase(network, {
      kind: "tvdb",
      path: "/search?query=x&type=series",
      configuredHost: "https://api4.thetvdb.com/v4",
      apiKey: "secret",
    })

    expect(resp.ok).toBe(true)
    expect(urls[0]).toContain("/login")
    expect(urls[1]).toContain("/search")
    // The login request must NOT carry an Authorization header.
    expect(headers[0]?.Authorization).toBeUndefined()
    // The actual request uses the JWT.
    expect(headers[1]?.Authorization).toBe("Bearer jwt-123")
  })

  it("caches the JWT and skips re-login for the same host", async () => {
    let loginCount = 0
    const network: NetworkPort = {
      fetch: async (url) => {
        if (url.endsWith("/login")) {
          loginCount += 1
          return jsonOk({ status: "success", data: { token: "jwt-123" } })
        }
        return jsonOk({ status: "success", data: [] })
      },
    }
    _resetTvdbTokenCacheForTests()

    const opts = {
      kind: "tvdb" as const,
      path: "/search?query=x&type=series",
      configuredHost: "https://api4.thetvdb.com/v4",
      apiKey: "secret",
    }
    await fetchMediaDatabase(network, opts)
    await fetchMediaDatabase(network, opts)

    expect(loginCount).toBe(1)
    _resetTvdbTokenCacheForTests()
  })

  it("still sends the raw API key as Bearer for a custom TMDB host (no login)", async () => {
    const urls: string[] = []
    const headers: Array<Record<string, string | undefined>> = []
    const network: NetworkPort = {
      fetch: async (url, init) => {
        urls.push(url)
        headers.push(init?.headers ?? {})
        return jsonOk({ results: [] })
      },
    }

    await fetchMediaDatabase(network, {
      kind: "tmdb",
      path: "/search/tv?query=x",
      configuredHost: "https://api.themoviedb.org/3",
      apiKey: "secret",
    })

    expect(urls[0]).not.toContain("/login")
    expect(headers[0]?.Authorization).toBe("Bearer secret")
  })
})
