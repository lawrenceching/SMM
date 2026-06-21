import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { MovieMediaMetadata, TMDBMovie } from "@core/types"
import type { TVDBv4SearchResult } from "@smm/tvdb4"
import type { TVDBSearchItem } from "@/lib/tvdbSearchNormalize"
import { useSelectMovieForFolderMutation } from "./useSelectMovieForFolderMutation"
import { useGetTmdbMovieMutation } from "../useGetTmdbMovieMutation"
import { useGetTvdbMovieMutation } from "../useGetTvdbMovieMutation"
import { toast } from "sonner"

const hoisted = vi.hoisted(() => ({
  fetchMediaMetadataAsync: vi.fn(),
  updateMediaMetadataAsync: vi.fn(),
  updateFolderStatus: vi.fn(),
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

vi.mock("@/lib/utils", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/utils")>()
  return { ...mod, nextTraceId: () => "test-trace" }
})

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

const resolvedMovie: MovieMediaMetadata = {
  id: "99",
  name: "Resolved Movie",
  database: "TMDB",
}

vi.mock("../useGetTmdbMovieMutation", () => ({
  useGetTmdbMovieMutation: vi.fn((options?: { onMutate?: (v: unknown) => void; onSuccess?: (d: unknown, v: unknown) => void; onError?: (e: Error, v: unknown) => void }) => ({
    mutate: vi.fn((vars: unknown) => {
      options?.onMutate?.(vars)
      options?.onSuccess?.(resolvedMovie, vars)
    }),
    mutateAsync: vi.fn(async (vars: unknown) => {
      options?.onMutate?.(vars)
      options?.onSuccess?.(resolvedMovie, vars)
      return resolvedMovie
    }),
    isPending: false,
  })),
}))

vi.mock("../useGetTvdbMovieMutation", () => ({
  useGetTvdbMovieMutation: vi.fn((options?: { onMutate?: (v: unknown) => void; onSuccess?: (d: unknown, v: unknown) => void; onError?: (e: Error, v: unknown) => void }) => ({
    mutate: vi.fn((vars: unknown) => {
      options?.onMutate?.(vars)
      options?.onSuccess?.(resolvedMovie, vars)
    }),
    mutateAsync: vi.fn(async (vars: unknown) => {
      options?.onMutate?.(vars)
      options?.onSuccess?.(resolvedMovie, vars)
      return resolvedMovie
    }),
    isPending: false,
  })),
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
    hoisted.fetchMediaMetadataAsync.mockResolvedValue({
      ...baseMovieFolderMetadata,
    })
    hoisted.updateMediaMetadataAsync.mockResolvedValue(undefined)
  })

  it("TMDB: routes mutate to useGetTmdbMovieMutation with id, language, mediaFolderPath, traceId, baseMetadata", () => {
    const { result } = renderHook(() => useSelectMovieForFolderMutation(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.selectMovieForFolderMutation.mutate({
        mediaFolderPath: "/library/movie",
        baseMetadata: baseMovieFolderMetadata,
        database: "TMDB",
        result: minimalTmdbMovie,
        searchLanguage: "en-US",
      })
    })

    expect(useGetTmdbMovieMutation).toHaveBeenCalled()
    const tmdbReturn = vi.mocked(useGetTmdbMovieMutation).mock.results[0]!.value as {
      mutate: ReturnType<typeof vi.fn>
    }
    expect(tmdbReturn.mutate).toHaveBeenCalledWith({
      id: 99,
      language: "en-US",
      mediaFolderPath: "/library/movie",
      traceId: "MovieSearchResultSelected-test-trace",
      baseMetadata: baseMovieFolderMetadata,
    })

    const tvdbReturn = vi.mocked(useGetTvdbMovieMutation).mock.results[0]!.value as {
      mutate: ReturnType<typeof vi.fn>
    }
    expect(tvdbReturn.mutate).not.toHaveBeenCalled()
  })

  it("TVDB: routes mutate to useGetTvdbMovieMutation with movieId from tvdb_id", () => {
    const { result } = renderHook(() => useSelectMovieForFolderMutation(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.selectMovieForFolderMutation.mutate({
        mediaFolderPath: "/library/movie",
        baseMetadata: baseMovieFolderMetadata,
        database: "TVDB",
        result: tvdbResult({ tvdb_id: "888" }) as unknown as TVDBSearchItem,
        searchLanguage: "zh-CN",
      })
    })

    const tvdbReturn = vi.mocked(useGetTvdbMovieMutation).mock.results[0]!.value as {
      mutate: ReturnType<typeof vi.fn>
    }
    expect(tvdbReturn.mutate).toHaveBeenCalledWith({
      movieId: 888,
      language: "zh-CN",
      mediaFolderPath: "/library/movie",
      traceId: "MovieSearchResultSelected-test-trace",
      baseMetadata: baseMovieFolderMetadata,
    })

    const tmdbReturn = vi.mocked(useGetTmdbMovieMutation).mock.results[0]!.value as {
      mutate: ReturnType<typeof vi.fn>
    }
    expect(tmdbReturn.mutate).not.toHaveBeenCalled()
  })

  it("runs onMutate/onSuccess: folder loading, persists base then movie via updateMediaMetadata", async () => {
    const { result } = renderHook(() => useSelectMovieForFolderMutation(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.selectMovieForFolderMutation.mutate({
        mediaFolderPath: "/library/movie",
        baseMetadata: baseMovieFolderMetadata,
        database: "TMDB",
        result: minimalTmdbMovie,
        searchLanguage: "en-US",
      })
    })

    expect(hoisted.updateFolderStatus).toHaveBeenCalledWith("/library/movie", "loading")

    await waitFor(() => {
      expect(hoisted.fetchMediaMetadataAsync).toHaveBeenCalled()
      expect(hoisted.updateMediaMetadataAsync).toHaveBeenCalled()
    })

    const writes = hoisted.updateMediaMetadataAsync.mock.calls.map((c) => c[0].metadata)
    const withMovie = writes.find((m) => (m as { movie?: MovieMediaMetadata }).movie?.id === "99")
    expect(withMovie).toBeDefined()
    expect((withMovie as { movie: MovieMediaMetadata }).movie.name).toBe("Resolved Movie")

    const baseWrite = writes.find(
      (m) =>
        (m as { movie?: MovieMediaMetadata }).movie === undefined &&
        (m as { type?: string }).type === "movie-folder",
    )
    expect(baseWrite).toBeDefined()
  })

  it("onTmdbError: toast.error with TMDB prefix", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      vi.mocked(useGetTmdbMovieMutation).mockImplementationOnce(
        ((options?: { onMutate?: (v: unknown) => void; onError?: (e: Error, v: unknown) => void }) => ({
          mutate: vi.fn((vars: unknown) => {
            options?.onMutate?.(vars)
            options?.onError?.(new Error("TMDB down"), vars)
          }),
          mutateAsync: vi.fn(),
          isPending: false,
        })) as typeof useGetTmdbMovieMutation,
      )

      const { result } = renderHook(() => useSelectMovieForFolderMutation(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.selectMovieForFolderMutation.mutate({
          mediaFolderPath: "/library/movie",
          baseMetadata: baseMovieFolderMetadata,
          database: "TMDB",
          result: minimalTmdbMovie,
          searchLanguage: "en-US",
        })
      })

      expect(toast.error).toHaveBeenCalledWith("Unable to fetch data from TMDB: TMDB down")
    } finally {
      consoleError.mockRestore()
    }
  })

  it("onTvdbError: toast.error with TVDB prefix", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      vi.mocked(useGetTvdbMovieMutation).mockImplementationOnce(
        ((options?: { onMutate?: (v: unknown) => void; onError?: (e: Error, v: unknown) => void }) => ({
          mutate: vi.fn((vars: unknown) => {
            options?.onMutate?.(vars)
            options?.onError?.(new Error("TVDB down"), vars)
          }),
          mutateAsync: vi.fn(),
          isPending: false,
        })) as typeof useGetTvdbMovieMutation,
      )

      const { result } = renderHook(() => useSelectMovieForFolderMutation(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.selectMovieForFolderMutation.mutate({
          mediaFolderPath: "/library/movie",
          baseMetadata: baseMovieFolderMetadata,
          database: "TVDB",
          result: tvdbResult() as unknown as TVDBSearchItem,
          searchLanguage: "en-US",
        })
      })

      expect(toast.error).toHaveBeenCalledWith("Unable to fetch data from TVDB: TVDB down")
    } finally {
      consoleError.mockRestore()
    }
  })

  it("isSelectMovieForFolderPending reflects underlying mutations", () => {
    vi.mocked(useGetTmdbMovieMutation).mockImplementationOnce(
      () =>
        ({
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
          isPending: true,
        }) as unknown as ReturnType<typeof useGetTmdbMovieMutation>,
    )
    vi.mocked(useGetTvdbMovieMutation).mockImplementationOnce(
      () =>
        ({
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
          isPending: false,
        }) as unknown as ReturnType<typeof useGetTvdbMovieMutation>,
    )

    const { result } = renderHook(() => useSelectMovieForFolderMutation(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isSelectMovieForFolderPending).toBe(true)
  })

  it("mutateAsync returns resolved movie metadata for TMDB", async () => {
    const { result } = renderHook(() => useSelectMovieForFolderMutation(), {
      wrapper: createWrapper(),
    })

    let out: MovieMediaMetadata | undefined
    await act(async () => {
      out = await result.current.selectMovieForFolderMutation.mutateAsync({
        mediaFolderPath: "/library/movie",
        baseMetadata: baseMovieFolderMetadata,
        database: "TMDB",
        result: minimalTmdbMovie,
        searchLanguage: "en-US",
      })
    })

    expect(out).toEqual(resolvedMovie)
  })
})
