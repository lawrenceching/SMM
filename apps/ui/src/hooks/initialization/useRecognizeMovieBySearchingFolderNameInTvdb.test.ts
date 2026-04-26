import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { TVDBv4SearchResult } from "@smm/tvdb4"
import type { MovieMediaMetadata } from "@core/types"
import { useRecognizeMovieBySearchingFolderNameInTvdb } from "./useRecognizeMovieBySearchingFolderNameInTvdb"
import { useTvdbQueries } from "../useTvdbQueries"
import { useGetTvdbMovieMutation } from "../useGetTvdbMovieMutation"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"

vi.mock("../useTvdbQueries", () => ({
  useTvdbQueries: vi.fn(),
}))

vi.mock("../useGetTvdbMovieMutation", () => ({
  useGetTvdbMovieMutation: vi.fn(),
}))

function createSearchResult(overrides: Partial<TVDBv4SearchResult>): TVDBv4SearchResult {
  return {
    id: "search-record-id",
    objectID: "obj",
    name: "Test Movie",
    image_url: "",
    overview: "",
    tvdb_id: "100",
    type: "movie",
    overviews: {},
    translations: {},
    extended_title: "",
    ...overrides,
  } as TVDBv4SearchResult
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe("useRecognizeMovieBySearchingFolderNameInTvdb", () => {
  const mockSearchTvdb = vi.fn()
  const mockGetMovieByIdFromTvdb = vi.fn()

  const movieMetadata: MovieMediaMetadata = {
    database: "TVDB",
    id: "15778",
    name: "Resolved Movie",
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useTvdbQueries).mockReturnValue({
      search: mockSearchTvdb,
    } as unknown as ReturnType<typeof useTvdbQueries>)
    vi.mocked(useGetTvdbMovieMutation).mockReturnValue({
      mutateAsync: mockGetMovieByIdFromTvdb,
    } as unknown as ReturnType<typeof useGetTvdbMovieMutation>)
    mockGetMovieByIdFromTvdb.mockResolvedValue(movieMetadata)
  })

  it("parses movie id from movie-prefixed search id and calls getMovieByIdFromTvdb with numeric id", async () => {
    mockSearchTvdb.mockResolvedValue([
      createSearchResult({
        id: "movie-15778",
        name: "The Dark Knight",
      }),
    ])

    const mediaMetadata: UIMediaMetadata = {
      type: "movie-folder",
      status: "idle",
      mediaFolderPath: "/library/The Dark Knight",
      mediaName: "ignored",
    } as UIMediaMetadata

    const { result } = renderHook(() => useRecognizeMovieBySearchingFolderNameInTvdb(), {
      wrapper: createWrapper(),
    })

    await result.current.mutateAsync({
      mediaMetadata,
      language: "zh-CN",
    })

    await waitFor(() => {
      expect(mockGetMovieByIdFromTvdb).toHaveBeenCalledTimes(1)
    })

    expect(mockGetMovieByIdFromTvdb).toHaveBeenCalledWith({
      movieId: 15778,
      language: "zh-CN",
    })
    expect(mockGetMovieByIdFromTvdb).not.toHaveBeenCalledWith(
      expect.objectContaining({ movieId: Number.NaN }),
    )
  })

  it("returns undefined and does not call getMovieByIdFromTvdb when first result has no valid numeric movie id", async () => {
    mockSearchTvdb.mockResolvedValue([
      createSearchResult({
        id: "movie-invalid",
        objectID: "unknown",
        tvdb_id: "",
      }),
    ])

    const mediaMetadata: UIMediaMetadata = {
      type: "movie-folder",
      status: "idle",
      mediaFolderPath: "/library/Invalid Id Movie",
      mediaName: "Invalid",
    } as UIMediaMetadata

    const { result } = renderHook(() => useRecognizeMovieBySearchingFolderNameInTvdb(), {
      wrapper: createWrapper(),
    })

    const out = await result.current.mutateAsync({
      mediaMetadata,
      language: "en-US",
    })

    expect(out).toBeUndefined()
    expect(mockGetMovieByIdFromTvdb).not.toHaveBeenCalled()
  })
})
