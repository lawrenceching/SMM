import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { TMDBTVShow, TvShowMediaMetadata } from "@core/types"
import type { TVDBv4SearchResult } from "@smm/tvdb4"
import type { TVDBSearchItem } from "@/lib/tvdbSearchNormalize"
import { useSelectTvShowForFolderMutation } from "./useSelectTvShowForFolderMutation"
import { useGetTmdbTvShowMutation } from "./useGetTmdbTvShowMutation"
import { useGetTvdbTvShowMutation } from "./useGetTvdbTvShowMutation"
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

const resolvedTvShow: TvShowMediaMetadata = {
  id: "42",
  name: "Resolved Show",
  database: "TMDB",
  seasons: [],
}

vi.mock("./useGetTmdbTvShowMutation", () => ({
  useGetTmdbTvShowMutation: vi.fn((options?: { onMutate?: (v: unknown) => void; onSuccess?: (d: unknown, v: unknown) => void; onError?: (e: Error, v: unknown) => void }) => ({
    mutate: vi.fn((vars: unknown) => {
      options?.onMutate?.(vars)
      options?.onSuccess?.(resolvedTvShow, vars)
    }),
    mutateAsync: vi.fn(async (vars: unknown) => {
      options?.onMutate?.(vars)
      options?.onSuccess?.(resolvedTvShow, vars)
      return resolvedTvShow
    }),
    isPending: false,
  })),
}))

vi.mock("./useGetTvdbTvShowMutation", () => ({
  useGetTvdbTvShowMutation: vi.fn((options?: { onMutate?: (v: unknown) => void; onSuccess?: (d: unknown, v: unknown) => void; onError?: (e: Error, v: unknown) => void }) => ({
    mutate: vi.fn((vars: unknown) => {
      options?.onMutate?.(vars)
      options?.onSuccess?.(resolvedTvShow, vars)
    }),
    mutateAsync: vi.fn(async (vars: unknown) => {
      options?.onMutate?.(vars)
      options?.onSuccess?.(resolvedTvShow, vars)
      return resolvedTvShow
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
  })

  it("TMDB: routes mutate to useGetTmdbTvShowMutation with id, language, mediaFolderPath, traceId", () => {
    const { result } = renderHook(() => useSelectTvShowForFolderMutation(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.selectTvShowForFolderMutation.mutate({
        mediaFolderPath: "/library/show",
        database: "TMDB",
        result: minimalTmdbTv,
        searchLanguage: "en-US",
      })
    })

    expect(useGetTmdbTvShowMutation).toHaveBeenCalled()
    const tmdbReturn = vi.mocked(useGetTmdbTvShowMutation).mock.results[0]!.value as {
      mutate: ReturnType<typeof vi.fn>
    }
    expect(tmdbReturn.mutate).toHaveBeenCalledWith({
      id: 42,
      language: "en-US",
      mediaFolderPath: "/library/show",
      traceId: "TvShowSearchResultSelected-test-trace",
    })

    const tvdbReturn = vi.mocked(useGetTvdbTvShowMutation).mock.results[0]!.value as {
      mutate: ReturnType<typeof vi.fn>
    }
    expect(tvdbReturn.mutate).not.toHaveBeenCalled()
  })

  it("TVDB: routes mutate to useGetTvdbTvShowMutation with seriesId from tvdb_id", () => {
    const { result } = renderHook(() => useSelectTvShowForFolderMutation(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.selectTvShowForFolderMutation.mutate({
        mediaFolderPath: "/library/show",
        database: "TVDB",
        result: tvdbResult({ tvdb_id: "999" }) as unknown as TVDBSearchItem,
        searchLanguage: "zh-CN",
      })
    })

    const tvdbReturn = vi.mocked(useGetTvdbTvShowMutation).mock.results[0]!.value as {
      mutate: ReturnType<typeof vi.fn>
    }
    expect(tvdbReturn.mutate).toHaveBeenCalledWith({
      seriesId: 999,
      language: "zh-CN",
      mediaFolderPath: "/library/show",
      traceId: "TvShowSearchResultSelected-test-trace",
    })

    const tmdbReturn = vi.mocked(useGetTmdbTvShowMutation).mock.results[0]!.value as {
      mutate: ReturnType<typeof vi.fn>
    }
    expect(tmdbReturn.mutate).not.toHaveBeenCalled()
  })

  it("runs onMutate/onSuccess: folder loading then ok, persists tvShow via updateMediaMetadata", async () => {
    const { result } = renderHook(() => useSelectTvShowForFolderMutation(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.selectTvShowForFolderMutation.mutate({
        mediaFolderPath: "/library/show",
        database: "TMDB",
        result: minimalTmdbTv,
        searchLanguage: "en-US",
      })
    })

    expect(hoisted.updateFolderStatus).toHaveBeenCalledWith(
      expect.any(String),
      "loading",
    )
    expect(hoisted.updateFolderStatus).toHaveBeenCalledWith(expect.any(String), "ok")

    await waitFor(() => {
      expect(hoisted.fetchMediaMetadataAsync).toHaveBeenCalled()
      expect(hoisted.updateMediaMetadataAsync).toHaveBeenCalled()
    })

    const writes = hoisted.updateMediaMetadataAsync.mock.calls.map((c) => c[0].metadata)
    const withTvShow = writes.find((m) => (m as { tvShow?: TvShowMediaMetadata }).tvShow?.id === "42")
    expect(withTvShow).toBeDefined()
    expect((withTvShow as { tvShow: TvShowMediaMetadata }).tvShow.name).toBe("Resolved Show")
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

  it("onError: toast.error and folder status ok", () => {
    vi.mocked(useGetTmdbTvShowMutation).mockImplementationOnce(
      ((options?: { onMutate?: (v: unknown) => void; onError?: (e: Error, v: unknown) => void }) => ({
        mutate: vi.fn((vars: unknown) => {
          options?.onMutate?.(vars)
          options?.onError?.(new Error("TMDB down"), vars)
        }),
        mutateAsync: vi.fn(),
        isPending: false,
      })) as any,
    )

    const { result } = renderHook(() => useSelectTvShowForFolderMutation(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.selectTvShowForFolderMutation.mutate({
        mediaFolderPath: "/library/show",
        database: "TMDB",
        result: minimalTmdbTv,
        searchLanguage: "en-US",
      })
    })

    expect(toast.error).toHaveBeenCalledWith("TMDB down")
    expect(hoisted.updateFolderStatus).toHaveBeenCalledWith(expect.any(String), "ok")
  })

  it("isSelectTvShowForFolderPending reflects underlying mutations", () => {
    vi.mocked(useGetTmdbTvShowMutation).mockImplementationOnce(
      () =>
        ({
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
          isPending: true,
        }) as unknown as ReturnType<typeof useGetTmdbTvShowMutation>,
    )
    vi.mocked(useGetTvdbTvShowMutation).mockImplementationOnce(
      () =>
        ({
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
          isPending: false,
        }) as unknown as ReturnType<typeof useGetTvdbTvShowMutation>,
    )

    const { result } = renderHook(() => useSelectTvShowForFolderMutation(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isSelectTvShowForFolderPending).toBe(true)
  })
})
