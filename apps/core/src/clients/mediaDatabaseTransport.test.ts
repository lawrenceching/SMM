import { describe, expect, it } from "vitest";
import type { DiscoverPort } from "../ports/DiscoverPort";
import type { HttpResponse, NetworkPort } from "../ports/NetworkPort";
import { fetchMediaDatabase, MediaDatabaseFailoverExhaustedError } from "./mediaDatabaseTransport";

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
});
