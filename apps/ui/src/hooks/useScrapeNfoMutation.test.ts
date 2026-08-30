import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { MediaMetadata, UserConfig } from "@smm/types"
import { defaultUserConfig } from "@/api/readUserConfig"
import { helloQueryKey } from "@/lib/appQueryKeys"
import { useScrapeNfoMutation } from "./useScrapeNfoMutation"

const testHosts = vi.hoisted(() => {
  const REVERSE_PROXY_URL = "http://127.0.0.1:30002"
  const TEST_DEFAULT_UPSTREAM = "http://127.0.0.1:39998/api/tmdb"
  const CUSTOM_TMDB_UPSTREAM = "http://127.0.0.1:39999/3"
  const MEDIA_LANGUAGE = "zh-CN"

  return {
    REVERSE_PROXY_URL,
    TEST_DEFAULT_UPSTREAM,
    CUSTOM_TMDB_UPSTREAM,
    MEDIA_LANGUAGE,
  }
})

const {
  REVERSE_PROXY_URL,
  TEST_DEFAULT_UPSTREAM,
  CUSTOM_TMDB_UPSTREAM,
  MEDIA_LANGUAGE,
} = testHosts

vi.mock("@/api/readUserConfig", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/readUserConfig")>()
  return {
    ...actual,
    readUserConfig: vi.fn(),
  }
})

vi.mock("@/api/hello", () => ({
  hello: vi.fn(),
}))

vi.mock("@/api/discover", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/discover")>()
  return {
    ...actual,
    fetchDiscoverConfig: vi.fn(),
  }
})

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

vi.mock("@/lib/localStorages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/localStorages")>()
  return {
    ...actual,
    isSmmV3Enabled: vi.fn().mockReturnValue(false),
  }
})

import { readUserConfig } from "@/api/readUserConfig"
import { hello } from "@/api/hello"
import { fetchDiscoverConfig } from "@/api/discover"
import { _resetInternalReverseProxyCacheForTesting } from "@/api/fetchByInternalReverseProxy"
import { isSmmV3Enabled } from "@/lib/localStorages"

const mockReadUserConfig = vi.mocked(readUserConfig)
const mockHello = vi.mocked(hello)
const mockFetchDiscoverConfig = vi.mocked(fetchDiscoverConfig)

function userConfigWithTmdb(
  tmdb: Partial<UserConfig["tmdb"]> = {},
): UserConfig {
  return {
    ...defaultUserConfig,
    tmdb: {
      host: "",
      apiKey: "",
      httpProxy: "",
      ...tmdb,
    },
  }
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

function assertFetchUsesOnlyLoopbackHosts(mockFetchFn: ReturnType<typeof vi.spyOn<typeof fetch>>) {
  for (const [url] of mockFetchFn.mock.calls) {
    const href = String(url)
    expect(href).not.toContain("api.themoviedb.org")
    expect(href).not.toContain("mediadb.vercel.app")
    expect(href).toMatch(/^http:\/\/127\.0\.0\.1:/)
  }
}

describe("useScrapeNfoMutation — TMDB fetch wiring", () => {
  const movieMetadata = {
    type: "movie-folder",
    mediaFolderPath: "/media/Fight Club",
    movie: { id: "550", database: "TMDB", name: "Fight Club" },
  } as MediaMetadata

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isSmmV3Enabled).mockReturnValue(false)
    _resetInternalReverseProxyCacheForTesting()
    mockReadUserConfig.mockResolvedValue(userConfigWithTmdb())
    mockHello.mockResolvedValue({
      reverseProxyUrl: REVERSE_PROXY_URL,
      userDataDir: "/tmp/smm",
    } as Awaited<ReturnType<typeof hello>>)
    mockFetchDiscoverConfig.mockResolvedValue({
      mediaDatabases: [
        {
          type: "tmdb",
          url: TEST_DEFAULT_UPSTREAM,
          authorizationMethod: "none",
        },
      ],
      reverseProxies: [],
    })
    writeFileMock.mockResolvedValue({ data: true, error: null })
  })

  it("fetches TMDB movie via default upstream direct when no custom host is configured", async () => {
    useConfigMock.mockReturnValue({
      appConfig: { reverseProxyUrl: REVERSE_PROXY_URL },
      userConfig: { preferMediaLanguage: MEDIA_LANGUAGE, tmdb: {} },
    })
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(mockMovieDetails), { status: 200 }))

    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useScrapeNfoMutation(), {
      wrapper: createWrapper(queryClient),
    })

    await result.current.mutateAsync({ mediaMetadata: movieMetadata })

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    expect(fetchSpy.mock.calls[0]![0]).toBe(
      `${TEST_DEFAULT_UPSTREAM}/movie/550?language=${MEDIA_LANGUAGE}`,
    )
    assertFetchUsesOnlyLoopbackHosts(fetchSpy)
    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(writeFileMock.mock.calls[0]?.[0]).toMatch(/movie\.nfo$/)
  })

  it("routes custom TMDB host through local reverse proxy", async () => {
    useConfigMock.mockReturnValue({
      appConfig: { reverseProxyUrl: REVERSE_PROXY_URL },
      userConfig: {
        preferMediaLanguage: MEDIA_LANGUAGE,
        tmdb: { host: CUSTOM_TMDB_UPSTREAM },
      },
    })
    mockReadUserConfig.mockResolvedValue(
      userConfigWithTmdb({ host: CUSTOM_TMDB_UPSTREAM }),
    )
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(mockMovieDetails), { status: 200 }))

    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useScrapeNfoMutation(), {
      wrapper: createWrapper(queryClient),
    })

    await result.current.mutateAsync({ mediaMetadata: movieMetadata })

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    expect(fetchSpy.mock.calls[0]![0]).toBe(
      `${REVERSE_PROXY_URL}/movie/550?language=${MEDIA_LANGUAGE}`,
    )
    const headers = fetchSpy.mock.calls[0]![1]?.headers as Record<string, string>
    expect(headers["X-SMM-Proxy-Upstream-BaseURL"]).toBe(CUSTOM_TMDB_UPSTREAM)
    assertFetchUsesOnlyLoopbackHosts(fetchSpy)
  })

  it("falls back to hello cache reverseProxyUrl for custom TMDB host", async () => {
    useConfigMock.mockReturnValue({
      appConfig: {},
      userConfig: {
        preferMediaLanguage: MEDIA_LANGUAGE,
        tmdb: { host: CUSTOM_TMDB_UPSTREAM },
      },
    })
    mockReadUserConfig.mockResolvedValue(
      userConfigWithTmdb({ host: CUSTOM_TMDB_UPSTREAM }),
    )
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(mockMovieDetails), { status: 200 }))

    const queryClient = createTestQueryClient()
    queryClient.setQueryData(helloQueryKey, {
      reverseProxyUrl: REVERSE_PROXY_URL,
    })

    const { result } = renderHook(() => useScrapeNfoMutation(), {
      wrapper: createWrapper(queryClient),
    })

    await result.current.mutateAsync({ mediaMetadata: movieMetadata })

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    expect(fetchSpy.mock.calls[0]![0]).toBe(
      `${REVERSE_PROXY_URL}/movie/550?language=${MEDIA_LANGUAGE}`,
    )
    assertFetchUsesOnlyLoopbackHosts(fetchSpy)
  })

  it("fails when custom TMDB host is configured but reverse proxy URL is unavailable", async () => {
    useConfigMock.mockReturnValue({
      appConfig: {},
      userConfig: {
        preferMediaLanguage: MEDIA_LANGUAGE,
        tmdb: { host: CUSTOM_TMDB_UPSTREAM },
      },
    })
    mockReadUserConfig.mockResolvedValue(
      userConfigWithTmdb({ host: CUSTOM_TMDB_UPSTREAM }),
    )
    mockHello.mockResolvedValue({
      reverseProxyUrl: null,
      userDataDir: "/tmp/smm",
    } as Awaited<ReturnType<typeof hello>>)

    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useScrapeNfoMutation(), {
      wrapper: createWrapper(queryClient),
    })

    const fetchSpy = vi.spyOn(globalThis, "fetch")

    await expect(
      result.current.mutateAsync({ mediaMetadata: movieMetadata }),
    ).rejects.toThrow(/Reverse proxy URL is not available/)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalled()
  })
})
