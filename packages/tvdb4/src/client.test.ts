import { describe, expect, it, vi } from "vitest";
import { TVDBv4, TVDBv4Error } from "./client";

function makeFetchResponse(args: {
  ok: boolean;
  status: number;
  statusText: string;
  payload: unknown;
}) {
  return {
    ok: args.ok,
    status: args.status,
    statusText: args.statusText,
    async text() {
      return typeof args.payload === "string" ? args.payload : JSON.stringify(args.payload);
    },
    async json() {
      return args.payload;
    },
  };
}

describe("TVDBv4 client", () => {
  it("accepts optional logger (pino-compatible)", async () => {
    const errorLog = vi.fn();
    const debugLog = vi.fn();
    const logger = {
      trace: vi.fn(),
      debug: debugLog,
      info: vi.fn(),
      warn: vi.fn(),
      error: errorLog,
      fatal: vi.fn(),
    };

    const baseUrl = "https://example.com/v4";
    const fetchImpl = vi.fn(async () =>
      makeFetchResponse({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        payload: { error: "invalid key" },
      })
    );

    const client = new TVDBv4({ apiKey: "api-key", baseUrl, fetchImpl, logger });
    await expect(client.login()).rejects.toBeInstanceOf(TVDBv4Error);
    expect(errorLog).toHaveBeenCalled();
    expect(debugLog).toHaveBeenCalled();
  });

  it("login(): extracts token from /login response", async () => {
    const baseUrl = "https://example.com/v4";

    const fetchImpl = vi.fn(async (input: string, init?: any) => {
      expect(input).toBe(`${baseUrl}/login`);
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body);
      expect(body.apikey).toBe("api-key");
      expect(body.pin).toBeUndefined();
      return makeFetchResponse({
        ok: true,
        status: 200,
        statusText: "OK",
        payload: { status: "success", data: { token: "token-123" } },
      });
    });

    const client = new TVDBv4({ apiKey: "api-key", baseUrl, fetchImpl });
    await expect(client.login()).resolves.toBe("token-123");
  });

  it("search(): attaches Bearer token and builds query string", async () => {
    const baseUrl = "https://example.com/v4";
    const fetchImpl = vi.fn(async (input: string, init?: any) => {
      if (input === `${baseUrl}/login`) {
        return makeFetchResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          payload: { status: "success", data: { token: "token-abc" } },
        });
      }

      expect(input).toMatch(/^https:\/\/example\.com\/v4\/search\?/);
      // Ensure token header is present.
      expect(init.headers.Authorization).toBe("Bearer token-abc");
      expect(input).toContain("query=foo");
      expect(input).toContain("type=series");
      expect(input).toContain("language=eng");
      expect(input).toContain("page=2");
      expect(input).toContain("limit=10");

      return makeFetchResponse({
        ok: true,
        status: 200,
        statusText: "OK",
        payload: { status: "success", data: [{ id: "1", name: "Foo" }] },
      });
    });

    const client = new TVDBv4({
      apiKey: "api-key",
      baseUrl,
      fetchImpl,
    });

    const resp = await client.search({
      query: "foo",
      type: "tv",
      language: "eng",
      page: 2,
      limit: 10,
    });

    expect(resp.status).toBe("success");
    expect(resp.data[0].name).toBe("Foo");
  });

  it("token cache: does not call /login more than once for multiple requests", async () => {
    const baseUrl = "https://example.com/v4";
    const fetchImpl = vi.fn(async (input: string, init?: any) => {
      if (input === `${baseUrl}/login`) {
        return makeFetchResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          payload: { status: "success", data: { token: "token-xyz" } },
        });
      }

      if (input.startsWith(`${baseUrl}/episodes`)) {
        expect(init.headers.Authorization).toBe("Bearer token-xyz");
        return makeFetchResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          payload: { status: "success", data: [{ id: 10 }] },
        });
      }

      if (input.startsWith(`${baseUrl}/movies`)) {
        expect(init.headers.Authorization).toBe("Bearer token-xyz");
        return makeFetchResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          payload: { status: "success", data: [{ id: 20 }] },
        });
      }

      throw new Error(`Unexpected URL: ${input}`);
    });

    const client = new TVDBv4({ apiKey: "api-key", baseUrl, fetchImpl });
    await client.episodes({ page: 1 });
    await client.movies({ page: 3 });

    const loginCalls = fetchImpl.mock.calls.filter(([input]) => input === `${baseUrl}/login`);
    expect(loginCalls).toHaveLength(1);
  });

  it("extended detail endpoints: call /series/{id}/extended and /movies/{id}/extended", async () => {
    const baseUrl = "https://example.com/v4";
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (input: string, init?: any) => {
      urls.push(input);
      if (input === `${baseUrl}/login`) {
        return makeFetchResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          payload: { status: "success", data: { token: "token-ext" } },
        });
      }

      expect(init.headers.Authorization).toBe("Bearer token-ext");
      return makeFetchResponse({
        ok: true,
        status: 200,
        statusText: "OK",
        payload: { status: "success", data: { id: 1 } },
      });
    });

    const client = new TVDBv4({ apiKey: "api-key", baseUrl, fetchImpl });
    await client.getSeriesExtended(123);
    await client.getMovieExtended(456);

    expect(urls).toContain(`${baseUrl}/series/123/extended`);
    expect(urls).toContain(`${baseUrl}/movies/456/extended`);
  });

  it("error propagation: throws TVDBv4Error on non-2xx responses", async () => {
    const baseUrl = "https://example.com/v4";

    const fetchImpl = vi.fn(async (input: string, init?: any) => {
      if (input === `${baseUrl}/login`) {
        return makeFetchResponse({
          ok: true,
          status: 200,
          statusText: "OK",
          payload: { status: "success", data: { token: "token-err" } },
        });
      }

      if (input.startsWith(`${baseUrl}/search`)) {
        return makeFetchResponse({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          payload: { error: "bad api key" },
        });
      }

      throw new Error(`Unexpected URL: ${input}`);
    });

    const client = new TVDBv4({ apiKey: "api-key", baseUrl, fetchImpl });

    try {
      await client.search({ query: "foo", type: "tv" });
      throw new Error("Expected search() to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(TVDBv4Error);
      const tvdbErr = err as TVDBv4Error;
      expect(tvdbErr.status).toBe(401);
      expect(tvdbErr.message).toMatch(/bad api key/i);
    }
  });
});

