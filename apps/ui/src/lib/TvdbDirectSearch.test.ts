import { afterEach, describe, expect, it, vi } from "vitest";
import { searchTvdbDirect } from "./TvdbDirectSearch";

describe("searchTvdbDirect", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls /search and returns data on success envelope", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "success",
        data: [{ objectID: "series-1", name: "Foo" }],
      }),
    });
    vi.stubGlobal("fetch", mock);

    const result = await searchTvdbDirect(
      { query: "Foo", type: "series" },
      { baseUrl: "https://example.com/api/tvdb" },
    );

    expect(result).toEqual([{ objectID: "series-1", name: "Foo" }]);
    const calledUrl = mock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toBe(
      "https://example.com/api/tvdb/search?query=Foo&type=series",
    );
  });

  it("returns undefined on failure envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "failure", message: "nope" }),
      }),
    );

    const result = await searchTvdbDirect(
      { query: "Foo", type: "series" },
      { baseUrl: "https://example.com/api/tvdb" },
    );
    expect(result).toBeUndefined();
  });

  it("adds Authorization Bearer header for date-token endpoints", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success", data: [] }),
    });
    vi.stubGlobal("fetch", mock);

    await searchTvdbDirect(
      { query: "Foo", type: "series" },
      { baseUrl: "https://example.com/api", authorizationMethod: "date-token" },
    );

    const init = mock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Bearer \d{4}-\d{2}-\d{2}$/);
  });

  it("throws when response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 502, statusText: "Bad Gateway" }),
    );

    await expect(
      searchTvdbDirect(
        { query: "Foo", type: "series" },
        { baseUrl: "https://example.com/api/tvdb" },
      ),
    ).rejects.toThrow(/Direct TVDB search failed: 502/);
  });
});
