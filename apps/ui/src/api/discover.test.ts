import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDiscoveredMediaDatabases } from "./discover";

describe("fetchDiscoveredMediaDatabases", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses the response and returns mediaDatabases", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            mediaDatabases: [
              { type: "tmdb", url: "https://a.com/api/tmdb", authorizationMethod: "none" },
              { type: "tvdb", url: "https://a.com/api/tvdb", authorizationMethod: "date-token" },
            ],
          },
        }),
      }),
    );

    const result = await fetchDiscoveredMediaDatabases();
    expect(result).toEqual([
      { type: "tmdb", url: "https://a.com/api/tmdb", authorizationMethod: "none" },
      { type: "tvdb", url: "https://a.com/api/tvdb", authorizationMethod: "date-token" },
    ]);
  });

  it("returns empty array when response.data is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );

    const result = await fetchDiscoveredMediaDatabases();
    expect(result).toEqual([]);
  });

  it("returns empty array when response is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { mediaDatabases: [{ type: "bogus" }] } }),
      }),
    );

    const result = await fetchDiscoveredMediaDatabases();
    expect(result).toEqual([]);
  });

  it("throws when fetch returns non-ok status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Internal Server Error" }),
    );

    await expect(fetchDiscoveredMediaDatabases()).rejects.toThrow(
      "Discover request failed: 500",
    );
  });
});
