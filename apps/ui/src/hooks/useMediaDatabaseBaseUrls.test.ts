import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMediaDatabaseBaseUrls } from "./useMediaDatabaseBaseUrls";
import { SMM_TMDB_DEFAULT_UPSTREAM } from "@/api/tmdb";
import { SMM_TVDB_DEFAULT_UPSTREAM } from "@/lib/TvdbUtils";
import { discoveredMediaDatabasesQueryKey } from "./useDiscoveredMediaDatabaseBaseUrls";
import type { MediaDatabaseEndpoint } from "@/api/discover";
import { createElement, type ReactNode } from "react";

function makeWrapper(initialData?: MediaDatabaseEndpoint[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  if (initialData) {
    queryClient.setQueryData(discoveredMediaDatabasesQueryKey, initialData);
  }
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useMediaDatabaseBaseUrls", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns only the hardcoded default when no data is available", () => {
    const { result } = renderHook(() => useMediaDatabaseBaseUrls("tmdb"), {
      wrapper: makeWrapper(),
    });
    expect(result.current).toEqual([
      { url: SMM_TMDB_DEFAULT_UPSTREAM, authorizationMethod: "none" },
    ]);
  });

  it("includes discovered endpoints before the default", () => {
    const discovered: MediaDatabaseEndpoint[] = [
      { type: "tmdb", url: "https://discovered-a.com/api", authorizationMethod: "none" },
      { type: "tmdb", url: "https://discovered-b.com/api", authorizationMethod: "date-token" },
      { type: "tvdb", url: "https://discovered-tvdb.com/api", authorizationMethod: "none" },
    ];

    const { result } = renderHook(() => useMediaDatabaseBaseUrls("tmdb"), {
      wrapper: makeWrapper(discovered),
    });

    expect(result.current).toEqual([
      { url: "https://discovered-a.com/api", authorizationMethod: "none" },
      { url: "https://discovered-b.com/api", authorizationMethod: "date-token" },
      { url: SMM_TMDB_DEFAULT_UPSTREAM, authorizationMethod: "none" },
    ]);
  });

  it("prefers localStorage preferred URL over discovered", () => {
    localStorage.setItem(
      "preferTmdbBaseUrl",
      JSON.stringify({
        url: "https://preferred.com/api",
        authorizationMethod: "date-token",
      }),
    );

    const discovered: MediaDatabaseEndpoint[] = [
      { type: "tmdb", url: "https://discovered-a.com/api", authorizationMethod: "none" },
    ];

    const { result } = renderHook(() => useMediaDatabaseBaseUrls("tmdb"), {
      wrapper: makeWrapper(discovered),
    });

    expect(result.current[0]).toEqual({
      url: "https://preferred.com/api",
      authorizationMethod: "date-token",
    });
    expect(result.current.find((e) => e.url === "https://discovered-a.com/api")).toBeDefined();
    expect(result.current[result.current.length - 1]).toEqual({
      url: SMM_TMDB_DEFAULT_UPSTREAM,
      authorizationMethod: "none",
    });
  });

  it("deduplicates when discovered URL matches default", () => {
    const discovered: MediaDatabaseEndpoint[] = [
      { type: "tmdb", url: SMM_TMDB_DEFAULT_UPSTREAM, authorizationMethod: "none" },
      { type: "tmdb", url: "https://other.com/api", authorizationMethod: "none" },
    ];

    const { result } = renderHook(() => useMediaDatabaseBaseUrls("tmdb"), {
      wrapper: makeWrapper(discovered),
    });

    const urls = result.current.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("filters by type (TVDB vs TMDB)", () => {
    const discovered: MediaDatabaseEndpoint[] = [
      { type: "tmdb", url: "https://a.com/api/tmdb", authorizationMethod: "none" },
      { type: "tvdb", url: "https://a.com/api/tvdb", authorizationMethod: "none" },
    ];

    const { result: tmdbResult } = renderHook(() => useMediaDatabaseBaseUrls("tmdb"), {
      wrapper: makeWrapper(discovered),
    });
    const { result: tvdbResult } = renderHook(() => useMediaDatabaseBaseUrls("tvdb"), {
      wrapper: makeWrapper(discovered),
    });

    // The TMDB hook should not include any TVDB-only endpoint.
    expect(tmdbResult.current.find((e) => e.url.endsWith("/api/tvdb"))).toBeUndefined();
    // The TVDB hook should not include any discovered TMDB endpoint.
    // (It does include the hardcoded default upstream URL, but that is
    // SMM_TVDB_DEFAULT_UPSTREAM which we check separately.)
    expect(
      tvdbResult.current.find((e) => e.url === "https://a.com/api/tmdb"),
    ).toBeUndefined();
    expect(tvdbResult.current[0]).toEqual({
      url: "https://a.com/api/tvdb",
      authorizationMethod: "none",
    });
    expect(tvdbResult.current[tvdbResult.current.length - 1]).toEqual({
      url: SMM_TVDB_DEFAULT_UPSTREAM,
      authorizationMethod: "none",
    });
  });

  it("ignores localStorage values for the wrong type", () => {
    localStorage.setItem(
      "preferTvdbBaseUrl",
      JSON.stringify({
        url: "https://preferred-tvdb.com/api",
        authorizationMethod: "date-token",
      }),
    );

    const { result } = renderHook(() => useMediaDatabaseBaseUrls("tmdb"), {
      wrapper: makeWrapper(),
    });

    expect(result.current[0].url).toBe(SMM_TMDB_DEFAULT_UPSTREAM);
  });

  it("handles malformed localStorage JSON gracefully", () => {
    localStorage.setItem("preferTmdbBaseUrl", "{not valid json");

    const { result } = renderHook(() => useMediaDatabaseBaseUrls("tmdb"), {
      wrapper: makeWrapper(),
    });

    expect(result.current).toEqual([
      { url: SMM_TMDB_DEFAULT_UPSTREAM, authorizationMethod: "none" },
    ]);
  });

  it("treats missing url in localStorage as invalid", () => {
    localStorage.setItem("preferTmdbBaseUrl", JSON.stringify({ foo: "bar" }));

    const { result } = renderHook(() => useMediaDatabaseBaseUrls("tmdb"), {
      wrapper: makeWrapper(),
    });

    expect(result.current).toEqual([
      { url: SMM_TMDB_DEFAULT_UPSTREAM, authorizationMethod: "none" },
    ]);
  });
});
