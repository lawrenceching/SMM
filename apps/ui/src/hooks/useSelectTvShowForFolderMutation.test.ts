import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { TMDBTVShow } from "@smm/types"
import type { TVDBv4SearchResult } from "@smm/tvdb4"
import type { TVDBSearchItem } from "@/lib/tvdbSearchNormalize"
import { useSelectTvShowForFolderMutation } from "./useSelectTvShowForFolderMutation"
import { toast } from "sonner"

const hoisted = vi.hoisted(() => ({
  fetchMediaMetadataAsync: vi.fn(),
  updateMediaMetadataAsync: vi.fn(),
  updateFolderStatus: vi.fn(),
  recognizeFolderViaCore: vi.fn(),
}))

vi.mock("@/hooks/mediaMetadata/useFetchMediaMetadataMutation", () => ({
  useFetchMediaMetadataMutation: vi.fn(() => ({
    mutateAsync: hoisted.fetchMediaMetadataAsync,
  })),
}))

vi.mock("@/hooks/mediaMetadata/useUpdateMediaMetadataMutation", () => ({
  useUpdateMediaMetadataMutation: vi.fn(() => ({
    mutateAsync: hoisted.updateMediaMetadataAsync,
  })),
}))

vi.mock("@/stores/uiMediaFolderStore", () => ({
  useUIMediaFolderStore: {
    getState: () => ({ updateFolderStatus: hoisted.updateFolderStatus }),
  },
}))

vi.mock("@/api/recognizeFolder", () => ({
  recognizeFolderViaCore: hoisted.recognizeFolderViaCore,
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

const minimalTmdbTv: TMDBTVShow = {
  id: 42,
  name: "Search Hit",
  original_name: "Search Hit",
  overview: "",
  poster_path: null,
  backdrop_path: null,
  first_air_date: "2020-01-01",
  vote_average: 0,
  vote_count: 0,
  popularity: 0,
  genre_ids: [],
  origin_country: [],
}

function tvdbResult(overrides: Partial<TVDBv4SearchResult> = {}): TVDBv4SearchResult {
  return {
    id: "rec",
    objectID: "obj",
    name: "TVDB Show",
    image_url: "",
    overview: "",
    tvdb_id: "402412",
    type: "series",
    overviews: {},
    translations: {},
    extended_title: "",
    ...overrides,
  } as TVDBv4SearchResult
}

describe("useSelectTvShowForFolderMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.fetchMediaMetadataAsync.mockResolvedValue({
      mediaFolderPath: "/library/show",
      type: "tvshow-folder",
    })
    hoisted.updateMediaMetadataAsync.mockResolvedValue(undefined)
    hoisted.recognizeFolderViaCore.mockResolvedValue(undefined)
  })

  it("TMDB: calls recognizeFolderViaCore and invalidates media metadata query", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client: queryClient }, children)
    }

    const { result } = renderHook(() => useSelectTvShowForFolderMutation(), {
      wrapper: Wrapper,
    })

    await act(async () => {
      result.current.selectTvShowForFolderMutation.mutate({
        mediaFolderPath: "/library/show",
        database: "TMDB",
        result: minimalTmdbTv,
        searchLanguage: "en-US",
      })
    })

    await waitFor(() => {
      expect(hoisted.recognizeFolderViaCore).toHaveBeenCalledWith({
        path: "/library/show",
        db: "tmdb",
        id: "42",
      })
    })

    expect(hoisted.updateFolderStatus).toHaveBeenCalledWith(expect.any(String), "loading")
    expect(hoisted.updateFolderStatus).toHaveBeenCalledWith(expect.any(String), "ok")
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["mediaMetadata", "/library/show"],
    })
    expect(hoisted.updateMediaMetadataAsync).not.toHaveBeenCalled()
  })

  it("TVDB: calls recognizeFolderViaCore with tvdb db and id", async () => {
    const { result } = renderHook(() => useSelectTvShowForFolderMutation(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.selectTvShowForFolderMutation.mutate({
        mediaFolderPath: "/library/show",
        database: "TVDB",
        result: tvdbResult({ tvdb_id: "999" }) as unknown as TVDBSearchItem,
        searchLanguage: "zh-CN",
      })
    })

    await waitFor(() => {
      expect(hoisted.recognizeFolderViaCore).toHaveBeenCalledWith({
        path: "/library/show",
        db: "tvdb",
        id: "999",
      })
    })
  })

  it("on recognize error: toast.error and folder status ok", async () => {
    hoisted.recognizeFolderViaCore.mockRejectedValueOnce(new Error("not managed"))

    const { result } = renderHook(() => useSelectTvShowForFolderMutation(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.selectTvShowForFolderMutation.mutate({
        mediaFolderPath: "/library/show",
        database: "TMDB",
        result: minimalTmdbTv,
        searchLanguage: "en-US",
      })
    })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("not managed")
    })
    expect(hoisted.updateFolderStatus).toHaveBeenCalledWith(expect.any(String), "ok")
  })

  it("updateMediaMetadata: fetch then persist merged metadata", async () => {
    hoisted.fetchMediaMetadataAsync.mockResolvedValueOnce({
      mediaFolderPath: "/m",
      type: "tvshow-folder",
      tvShow: { id: "1", name: "Old", database: "TMDB", seasons: [] },
    })

    const { result } = renderHook(() => useSelectTvShowForFolderMutation(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await result.current.updateMediaMetadata("/m", (prev) => ({
        ...prev,
        tvShow: undefined,
      }))
    })

    expect(hoisted.fetchMediaMetadataAsync).toHaveBeenCalledWith({
      path: "/m",
      traceId: undefined,
    })
    expect(hoisted.updateMediaMetadataAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        pathPosix: "/m",
        metadata: expect.objectContaining({ tvShow: undefined }),
      }),
    )
  })
})
