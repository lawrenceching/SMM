import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { MediaMetadata } from "@core/types"
import { helloQueryKey } from "@/lib/appQueryKeys"
import { SMM_TMDB_DEFAULT_UPSTREAM } from "@/api/tmdb"
import { useScrapeNfoMutation } from "./useScrapeNfoMutation"
import { TmdbQueriesRuntimeProvider } from "./useTmdbQueries"

const REVERSE_PROXY_URL = "http://127.0.0.1:30002"
const MEDIA_LANGUAGE = "zh-CN"

const mockMovieDetails = {
  id: 550,
  title: "Fight Club",
  original_title: "Fight Club",
  release_date: "1999-10-15",
  poster_path: "/poster.jpg",
  backdrop_path: "/backdrop.jpg",
  vote_average: 8.4,
  vote_count: 20000,
  imdb_id: "tt0137523",
}

const writeFileMock = vi.fn().mockResolvedValue({ data: true, error: null })

const useConfigMock = vi.fn()

vi.mock("@/hooks/userConfig", () => ({
  useConfig: () => useConfigMock(),
}))

vi.mock("@/hooks/useResolvedLanguages", () => ({
  useResolvedLanguages: () => ({
    appLanguage: MEDIA_LANGUAGE,
    mediaLanguage: MEDIA_LANGUAGE,
  }),
}))

vi.mock("@/hooks/userConfig/useHelloQuery", () => ({
  useHelloQuery: () => ({ data: undefined }),
}))

vi.mock("@/api/writeFile", () => ({
  writeFile: (...args: unknown[]) => writeFileMock(...args),
}))

vi.mock("./useTvdbQueries", () => ({
  useTvdbQueries: () => ({
    getSeriesExtended: vi.fn(),
    getSeasonExtended: vi.fn(),
    getMovieExtended: vi.fn(),
    getSeriesTranslationByLangCode: vi.fn(),
    getEpisodeTranslationByLangCode: vi.fn(),
    getMovieTranslationByLangCode: vi.fn(),
  }),
}))

vi.mock("debug", () => ({
  default: () => vi.fn(),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function createWrapper(queryClient: QueryClient, fetchFn: typeof fetch) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(TmdbQueriesRuntimeProvider, { fetchFn }, children),
    )
}

describe("useScrapeNfoMutation — TMDB reverse proxy wiring", () => {
  const mockFetchFn = vi.fn<typeof fetch>()

  const movieMetadata = {
    type: "movie-folder",
    mediaFolderPath: "/media/Fight Club",
    movie: { id: "550", database: "TMDB", name: "Fight Club" },
  } as MediaMetadata

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchFn.mockImplementation((_url, _init) =>
      Promise.resolve(
        new Response(JSON.stringify(mockMovieDetails), { status: 200 }),
      ),
    )
    useConfigMock.mockReturnValue({
      appConfig: { reverseProxyUrl: REVERSE_PROXY_URL },
      userConfig: { preferMediaLanguage: MEDIA_LANGUAGE, tmdb: {} },
    })
    writeFileMock.mockResolvedValue({ data: true, error: null })
  })

  it("routes TMDB movie lookup through reverse proxy via useTmdbQueries", async () => {
    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useScrapeNfoMutation(), {
      wrapper: createWrapper(queryClient, mockFetchFn),
    })

    await result.current.mutateAsync({ mediaMetadata: movieMetadata })

    await waitFor(() => {
      expect(mockFetchFn).toHaveBeenCalledTimes(1)
    })

    const [url, init] = mockFetchFn.mock.calls[0]!
    expect(url).toBe(`${REVERSE_PROXY_URL}/movie/550?language=${MEDIA_LANGUAGE}`)
    const headers = init?.headers as Record<string, string>
    expect(headers["X-SMM-Proxy-Upstream-BaseURL"]).toBe(SMM_TMDB_DEFAULT_UPSTREAM)
    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(writeFileMock.mock.calls[0]?.[0]).toMatch(/movie\.nfo$/)
  })

  it("falls back to hello cache reverseProxyUrl when appConfig has none", async () => {
    useConfigMock.mockReturnValue({
      appConfig: {},
      userConfig: { preferMediaLanguage: MEDIA_LANGUAGE, tmdb: {} },
    })

    const queryClient = createTestQueryClient()
    queryClient.setQueryData(helloQueryKey, {
      reverseProxyUrl: REVERSE_PROXY_URL,
    })

    const { result } = renderHook(() => useScrapeNfoMutation(), {
      wrapper: createWrapper(queryClient, mockFetchFn),
    })

    await result.current.mutateAsync({ mediaMetadata: movieMetadata })

    await waitFor(() => {
      expect(mockFetchFn).toHaveBeenCalledTimes(1)
    })

    expect(mockFetchFn.mock.calls[0]![0]).toBe(
      `${REVERSE_PROXY_URL}/movie/550?language=${MEDIA_LANGUAGE}`,
    )
  })

  it("fails when reverse proxy URL is unavailable", async () => {
    useConfigMock.mockReturnValue({
      appConfig: {},
      userConfig: { preferMediaLanguage: MEDIA_LANGUAGE, tmdb: {} },
    })

    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useScrapeNfoMutation(), {
      wrapper: createWrapper(queryClient, mockFetchFn),
    })

    await expect(
      result.current.mutateAsync({ mediaMetadata: movieMetadata }),
    ).rejects.toThrow(/Reverse proxy URL is not available/)

    expect(mockFetchFn).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalled()
  })
})
