import { afterEach, describe, expect, it, vi } from "vitest";
import { searchTmdbDirect } from "./tmdbDirect";

describe("searchTmdbDirect", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the given baseUrl with /search/{type} and returns parsed JSON", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [], page: 1 }),
    });
    vi.stubGlobal("fetch", mock);

    const result = await searchTmdbDirect("foo", "tv", "en-US", {
      baseUrl: "https://example.com/api/tmdb",
    });

    expect(result).toEqual({ results: [], page: 1 });
    const calledUrl = mock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toBe(
      "https://example.com/api/tmdb/search/tv?query=foo&language=en-US",
    );
  });

  it("strips trailing slashes from baseUrl", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", mock);

    await searchTmdbDirect("bar", "movie", "zh-CN", {
      baseUrl: "https://example.com/api/tmdb///",
    });

    const calledUrl = mock.mock.calls[0]?.[0] as string;
    expect(calledUrl.startsWith("https://example.com/api/tmdb/search/")).toBe(true);
    expect(calledUrl.includes("//search/")).toBe(false);
  });

  it("adds Authorization Bearer header for date-token endpoints", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", mock);

    await searchTmdbDirect("q", "tv", "en-US", {
      baseUrl: "https://example.com/api",
      authorizationMethod: "date-token",
    });

    const init = mock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Bearer \d{4}-\d{2}-\d{2}$/);
  });

  it("does not add Authorization header for 'none' endpoints", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", mock);

    await searchTmdbDirect("q", "tv", "en-US", {
      baseUrl: "https://example.com/api",
      authorizationMethod: "none",
    });

    const init = mock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("throws when response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" }),
    );

    await expect(
      searchTmdbDirect("q", "tv", "en-US", { baseUrl: "https://example.com/api" }),
    ).rejects.toThrow(/Direct TMDB search failed: 500/);
  });
});
