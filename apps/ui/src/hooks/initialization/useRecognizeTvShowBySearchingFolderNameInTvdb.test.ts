import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { TVDBv4SearchResult } from "@smm/tvdb4"
import type { TvShowMediaMetadata } from "@core/types"
import { useRecognizeTvShowBySearchingFolderNameInTvdb } from "./useRecognizeTvShowBySearchingFolderNameInTvdb"
import { useTvdbQueries } from "../useTvdbQueries"
import { useGetTvdbTvShowMutation } from "../useGetTvdbTvShowMutation"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"

vi.mock("../useTvdbQueries", () => ({
  useTvdbQueries: vi.fn(),
}))

vi.mock("../useGetTvdbTvShowMutation", () => ({
  useGetTvdbTvShowMutation: vi.fn(),
}))

function createSearchResult(overrides: Partial<TVDBv4SearchResult>): TVDBv4SearchResult {
  return {
    id: "search-record-id",
    objectID: "obj",
    name: "Test Series",
    image_url: "",
    overview: "",
    tvdb_id: "100",
    type: "series",
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

describe("useRecognizeTvShowBySearchingFolderNameInTvdb", () => {
  const mockSearchTvdb = vi.fn()
  const mockGetTvShowByIdFromTvdb = vi.fn()

  const tvShowMetadata: TvShowMediaMetadata = {
    database: "TVDB",
    id: "402412",
    name: "Resolved Show",
    seasons: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useTvdbQueries).mockReturnValue({
      search: mockSearchTvdb,
    } as unknown as ReturnType<typeof useTvdbQueries>)
    vi.mocked(useGetTvdbTvShowMutation).mockReturnValue({
      mutateAsync: mockGetTvShowByIdFromTvdb,
    } as unknown as ReturnType<typeof useGetTvdbTvShowMutation>)
    mockGetTvShowByIdFromTvdb.mockResolvedValue(tvShowMetadata)
  })

  it("passes seriesId from search result tvdb_id, not id, to getTvShowByIdFromTvdb", async () => {
    mockSearchTvdb.mockResolvedValue([
      createSearchResult({
        id: "999999",
        tvdb_id: "402412",
        name: "Shown Name",
      }),
    ])

    const mediaMetadata: UIMediaMetadata = {
      type: "tvshow-folder",
      status: "idle",
      mediaFolderPath: "/library/MyFolderShow",
      mediaName: "ignored",
    } as UIMediaMetadata

    const { result } = renderHook(() => useRecognizeTvShowBySearchingFolderNameInTvdb(), {
      wrapper: createWrapper(),
    })

    await result.current.mutateAsync({
      mediaMetadata,
      language: "en-US",
    })

    await waitFor(() => {
      expect(mockGetTvShowByIdFromTvdb).toHaveBeenCalledTimes(1)
    })

    expect(mockGetTvShowByIdFromTvdb).toHaveBeenCalledWith({
      seriesId: 402412,
      language: "en-US",
    })
    expect(mockGetTvShowByIdFromTvdb).not.toHaveBeenCalledWith(
      expect.objectContaining({ seriesId: 999999 }),
    )
  })

  it("returns undefined when search returns no results", async () => {
    mockSearchTvdb.mockResolvedValue([])

    const mediaMetadata: UIMediaMetadata = {
      type: "tvshow-folder",
      status: "idle",
      mediaFolderPath: "/library/Empty",
      mediaName: "Empty",
    } as UIMediaMetadata

    const { result } = renderHook(() => useRecognizeTvShowBySearchingFolderNameInTvdb(), {
      wrapper: createWrapper(),
    })

    const out = await result.current.mutateAsync({
      mediaMetadata,
      language: "zh-CN",
    })

    expect(out).toBeUndefined()
    expect(mockGetTvShowByIdFromTvdb).not.toHaveBeenCalled()
  })
})
