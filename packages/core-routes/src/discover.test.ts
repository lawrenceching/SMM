import { Buffer } from "node:buffer";
import { describe, expect, it, vi, afterEach } from "vitest";
import type { CoreRoutesConfig } from "./types.ts";

function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("doFetchDiscoverConfig", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns normalized mediaDatabases and reverseProxies", async () => {
    const { doFetchDiscoverConfig } = await import("./discover.ts");
    const fetchImpl = vi.fn(() =>
      jsonResponse({
        mediaDatabases: [
          { type: "tmdb", baseUrl: "https://example.com/api/tmdb" },
          {
            type: "tmdb",
            url: "https://other.com/api/tmdb",
            authorizationMethod: "date-token",
          },
          { type: "tvdb", baseUrl: "https://example.com/api/tvdb" },
        ],
        reverseProxies: [
          {
            id: "gz1",
            type: "general",
            url: "https://proxy.example.com",
            authMethod: "date-token",
          },
        ],
        latestVersion: "1.4.5",
      }),
    );

    const result = await doFetchDiscoverConfig({ fetchImpl });

    expect(result.mediaDatabases).toEqual([
      {
        type: "tmdb",
        url: "https://example.com/api/tmdb",
        authorizationMethod: "none",
      },
      {
        type: "tmdb",
        url: "https://other.com/api/tmdb",
        authorizationMethod: "date-token",
      },
      {
        type: "tvdb",
        url: "https://example.com/api/tvdb",
        authorizationMethod: "none",
      },
    ]);
    expect(result.reverseProxies).toEqual([
      {
        id: "gz1",
        type: "general",
        url: "https://proxy.example.com",
        authorizationMethod: "date-token",
      },
    ]);
    expect(result.latestVersion).toBe("1.4.5");
  });

  it("returns hardcoded fallback mediaDatabases when remote fetch fails (non-OK)", async () => {
    const { doFetchDiscoverConfig } = await import("./discover.ts");
    const result = await doFetchDiscoverConfig({
      fetchImpl: () => jsonResponse("not found", 404),
    });
    expect(result.mediaDatabases.length).toBeGreaterThan(0);
    expect(result.reverseProxies).toEqual([]);
  });

  it("returns hardcoded fallback mediaDatabases when remote fetch throws", async () => {
    const { doFetchDiscoverConfig } = await import("./discover.ts");
    const result = await doFetchDiscoverConfig({
      fetchImpl: () => Promise.reject(new Error("network")),
    });
    expect(result.mediaDatabases.length).toBeGreaterThan(0);
    expect(result.reverseProxies).toEqual([]);
  });

  it("skips invalid mediaDatabases and reverseProxies entries", async () => {
    const { doFetchDiscoverConfig } = await import("./discover.ts");
    const result = await doFetchDiscoverConfig({
      fetchImpl: () =>
        jsonResponse({
          mediaDatabases: [
            { type: "unknown", url: "https://x.com" },
            { type: "tmdb" },
            { url: "https://no-type.com" },
            { type: "tmdb-asset", baseUrl: "https://tmdb-asset.example.com" },
            { type: "tvdb-asset", url: "https://tvdb-asset.example.com" },
          ],
          reverseProxies: [
            { type: "general", url: "https://proxy.example.com" },
            { id: "gz1", type: "unknown", url: "https://proxy.example.com" },
            { id: "gz2", type: "general" },
          ],
        }),
    });
    expect(result.mediaDatabases).toEqual([
      {
        type: "tmdb-asset",
        url: "https://tmdb-asset.example.com",
        authorizationMethod: "none",
      },
      {
        type: "tvdb-asset",
        url: "https://tvdb-asset.example.com",
        authorizationMethod: "none",
      },
    ]);
    expect(result.reverseProxies).toEqual([]);
  });
});

describe("GET /api/discover", () => {
  async function requestDiscover(config: CoreRoutesConfig) {
    const { handleDiscoverGet } = await import("./routes/discoverRoute.ts");
    const { IncomingMessage, ServerResponse } = await import("node:http");
    const { Socket } = await import("node:net");

    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = "GET";
    req.url = "/api/discover";
    req.headers = { accept: "application/json" };

    let status = 0;
    let body = "";
    const res = new ServerResponse(req);
    res.writeHead = ((code: number) => {
      status = code;
      return res;
    }) as typeof res.writeHead;
    res.end = ((chunk?: unknown) => {
      body = typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString("utf8") : "";
      return res;
    }) as typeof res.end;

    const handled = await handleDiscoverGet(req, res, {
      config,
      url: new URL("http://127.0.0.1:3001/api/discover"),
    });
    socket.destroy();
    return {
      handled,
      status,
      body: body ? (JSON.parse(body) as Record<string, unknown>) : {},
    };
  }

  it("returns 200 with discover data via discover route", async () => {
    const fetchImpl = vi.fn(() =>
      jsonResponse({
        mediaDatabases: [{ type: "tmdb", baseUrl: "https://example.com/api/tmdb" }],
      }),
    );

    const { handled, status, body } = await requestDiscover({
      allowlist: [],
      fetchImpl,
    });

    expect(handled).toBe(true);
    expect(status).toBe(200);
    expect(body).toEqual({
      data: {
        mediaDatabases: [
          {
            type: "tmdb",
            url: "https://example.com/api/tmdb",
            authorizationMethod: "none",
          },
        ],
        reverseProxies: [],
      },
    });
    expect(fetchImpl).toHaveBeenCalled();
  });
});
