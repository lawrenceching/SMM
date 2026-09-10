import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { TMDBMovie } from "@smm/types"
import type { TVDBv4SearchResult } from "@smm/tvdb4"
import type { TVDBSearchItem } from "@/lib/tvdbSearchNormalize"
import { useSelectMovieForFolderMutation } from "./useSelectMovieForFolderMutation"
import { toast } from "sonner"

const hoisted = vi.hoisted(() => ({
  updateFolderStatus: vi.fn(),
  recognizeFolderViaCore: vi.fn(),
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

const baseMovieFolderMetadata = {
  mediaFolderPath: "/library/movie",
  type: "movie-folder" as const,
}

const minimalTmdbMovie: TMDBMovie = {
  id: 99,
  title: "Search Hit",
  original_title: "Search Hit",
  overview: "",
  poster_path: null,
  backdrop_path: null,
  release_date: "2020-01-01",
  vote_average: 0,
  vote_count: 0,
  popularity: 0,
  genre_ids: [],
  adult: false,
  video: false,
}

function tvdbResult(overrides: Partial<TVDBv4SearchResult> = {}): TVDBv4SearchResult {
  return {
    id: "rec",
    objectID: "obj",
    name: "TVDB Movie",
    image_url: "",
    overview: "",
    tvdb_id: "402412",
    type: "movie",
    overviews: {},
    translations: {},
    extended_title: "",
    ...overrides,
  } as TVDBv4SearchResult
}

describe("useSelectMovieForFolderMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.recognizeFolderViaCore.mockResolvedValue(undefined)
  })

  it("TMDB: calls recognizeFolderViaCore with tmdb db and id, and invalidates media metadata query", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client: queryClient }, children)
    }

    const { result } = renderHook(() => useSelectMovieForFolderMutation(), {
      wrapper: Wrapper,
    })

    await act(async () => {
      result.current.selectMovieForFolderMutation.mutate({
        mediaFolderPath: "/library/movie",
        baseMetadata: baseMovieFolderMetadata,
        database: "TMDB",
        result: minimalTmdbMovie,
        searchLanguage: "en-US",
      })
    })

    await waitFor(() => {
      expect(hoisted.recognizeFolderViaCore).toHaveBeenCalledWith({
        path: "/library/movie",
        db: "tmdb",
        id: "99",
      })
    })

    expect(hoisted.updateFolderStatus).toHaveBeenCalledWith("/library/movie", "loading")
    expect(hoisted.updateFolderStatus).toHaveBeenCalledWith("/library/movie", "ok")
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["mediaMetadata", "/library/movie"],
    })
  })

  it("TVDB: calls recognizeFolderViaCore with tvdb db and id from tvdb_id", async () => {
    const { result } = renderHook(() => useSelectMovieForFolderMutation(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.selectMovieForFolderMutation.mutate({
        mediaFolderPath: "/library/movie",
        baseMetadata: baseMovieFolderMetadata,
        database: "TVDB",
        result: tvdbResult({ tvdb_id: "888" }) as unknown as TVDBSearchItem,
        searchLanguage: "zh-CN",
      })
    })

    await waitFor(() => {
      expect(hoisted.recognizeFolderViaCore).toHaveBeenCalledWith({
        path: "/library/movie",
        db: "tvdb",
        id: "888",
      })
    })
  })

  it("mutateAsync returns when recognizeFolderViaCore resolves", async () => {
    const { result } = renderHook(() => useSelectMovieForFolderMutation(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await result.current.selectMovieForFolderMutation.mutateAsync({
        mediaFolderPath: "/library/movie",
        baseMetadata: baseMovieFolderMetadata,
        database: "TMDB",
        result: minimalTmdbMovie,
        searchLanguage: "en-US",
      })
    })

    expect(hoisted.recognizeFolderViaCore).toHaveBeenCalledWith({
      path: "/library/movie",
      db: "tmdb",
      id: "99",
    })
  })

  it("on recognize error: toast.error and folder status ok", async () => {
    hoisted.recognizeFolderViaCore.mockRejectedValueOnce(new Error("not managed"))

    const { result } = renderHook(() => useSelectMovieForFolderMutation(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.selectMovieForFolderMutation.mutate({
        mediaFolderPath: "/library/movie",
        baseMetadata: baseMovieFolderMetadata,
        database: "TMDB",
        result: minimalTmdbMovie,
        searchLanguage: "en-US",
      })
    })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("not managed")
    })
    expect(hoisted.updateFolderStatus).toHaveBeenCalledWith("/library/movie", "ok")
  })
})
