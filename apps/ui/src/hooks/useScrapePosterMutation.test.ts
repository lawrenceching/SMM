/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import type { MediaMetadata, UserConfig } from "@smm/types"
import { defaultUserConfig } from "@/api/readUserConfig"
import {
  resolvePosterUrl,
  useScrapePosterMutation,
  type ScrapePosterMutationVariables,
} from "./useScrapePosterMutation"

function buildVariables(mediaMetadata: Partial<MediaMetadata>): ScrapePosterMutationVariables {
  return {
    mediaMetadata: {
      mediaFolderPath: "/tmp/test",
      ...mediaMetadata,
    } as MediaMetadata,
    language: "en-US",
  }
}

describe("resolvePosterUrl", () => {
  it("resolves TMDB tvshow poster", async () => {
    const vars = buildVariables({
      type: "tvshow-folder",
      tvShow: { id: "123", database: "TMDB", name: "TV", seasons: [] },
    })
    const result = await resolvePosterUrl(vars, {
      getTvShowById: vi.fn().mockResolvedValue({ poster_path: "/tmdb-tv-poster.jpg" }),
      getMovieById: vi.fn(),
      getSeriesExtended: vi.fn(),
      getMovieExtended: vi.fn(),
    } as any)
    expect(result).toContain("/original/tmdb-tv-poster.jpg")
  })

  it("resolves TVDB tvshow poster", async () => {
    const vars = buildVariables({
      type: "tvshow-folder",
      tvShow: { id: "321", database: "TVDB", name: "TV", seasons: [] },
    })
    const result = await resolvePosterUrl(vars, {
      getTvShowById: vi.fn(),
      getMovieById: vi.fn(),
      getSeriesExtended: vi.fn().mockResolvedValue({ image: "https://tvdb/series-poster.jpg", artworks: [] }),
      getMovieExtended: vi.fn(),
    } as any)
    expect(result).toBe("https://tvdb/series-poster.jpg")
  })

  it("resolves TMDB movie poster", async () => {
    const vars = buildVariables({
      type: "movie-folder",
      movie: { id: "456", database: "TMDB", name: "Movie" },
    })
    const result = await resolvePosterUrl(vars, {
      getTvShowById: vi.fn(),
      getMovieById: vi.fn().mockResolvedValue({ poster_path: "/tmdb-movie-poster.jpg" }),
      getSeriesExtended: vi.fn(),
      getMovieExtended: vi.fn(),
    } as any)
    expect(result).toContain("/original/tmdb-movie-poster.jpg")
  })

  it("resolves TVDB movie poster", async () => {
    const vars = buildVariables({
      type: "movie-folder",
      movie: { id: "654", database: "TVDB", name: "Movie" },
    })
    const result = await resolvePosterUrl(vars, {
      getTvShowById: vi.fn(),
      getMovieById: vi.fn(),
      getSeriesExtended: vi.fn(),
      getMovieExtended: vi.fn().mockResolvedValue({ id: 654, image: "https://tvdb/movie-poster.jpg" }),
    } as any)
    expect(result).toBe("https://tvdb/movie-poster.jpg")
  })
})

const mockDownloadScrapeImage = vi.fn().mockResolvedValue(undefined)
vi.mock("@/lib/downloadScrapeImage", () => ({
  downloadScrapeImage: (...args: unknown[]) => mockDownloadScrapeImage(...args),
}))

vi.mock("@/lib/utils", async (importOriginal) => ({
  ...(await importOriginal()),
  checkFileExists: vi.fn().mockResolvedValue(false),
}))

let useConfigValue: UserConfig = defaultUserConfig
vi.mock("./userConfig", () => ({
  useConfig: () => ({ appConfig: {}, userConfig: useConfigValue }),
}))

vi.mock("@/hooks/useTmdbQueries", () => ({
  useTmdbQueries: () => ({
    getTvShowById: vi.fn(),
    getMovieById: vi.fn().mockResolvedValue({ poster_path: "/poster.jpg" }),
  }),
}))

vi.mock("@/hooks/useTvdbQueries", () => ({
  useTvdbQueries: () => ({
    getSeriesExtended: vi.fn(),
    getMovieExtended: vi.fn(),
  }),
}))

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

const posterMovie: MediaMetadata = {
  type: "movie-folder",
  mediaFolderPath: "/media/Fight Club",
  movie: { id: "550", database: "TMDB", name: "Fight Club" },
} as MediaMetadata

describe("useScrapePosterMutation wiring", () => {
  beforeEach(() => {
    mockDownloadScrapeImage.mockClear()
    useConfigValue = {
      ...defaultUserConfig,
      tmdb: { host: "https://api.themoviedb.org", apiKey: "", httpProxy: "http://proxy:8080" },
    }
  })

  it("passes the configured userConfig through to downloadScrapeImage", async () => {
    const { result } = renderHook(() => useScrapePosterMutation(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ mediaMetadata: posterMovie, language: "en-US" })

    expect(mockDownloadScrapeImage).toHaveBeenCalledTimes(1)
    const [md, url, path, uc] = mockDownloadScrapeImage.mock.calls[0] as [MediaMetadata, string, string, UserConfig]
    expect(md).toBe(posterMovie)
    expect(url).toBe("https://image.tmdb.org/t/p/original/poster.jpg")
    expect(path).toBe("/media/Fight Club/poster.jpg")
    expect(uc).toBe(useConfigValue)
  })
})

