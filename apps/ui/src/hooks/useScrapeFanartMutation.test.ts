/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import type { MediaMetadata, UserConfig } from "@smm/types"
import { defaultUserConfig } from "@/api/readUserConfig"
import {
  resolveFanartUrl,
  useScrapeFanartMutation,
  type ScrapeFanartMutationVariables,
} from "./useScrapeFanartMutation"

function buildVariables(mediaMetadata: Partial<MediaMetadata>): ScrapeFanartMutationVariables {
  return {
    mediaMetadata: {
      mediaFolderPath: "/tmp/test",
      ...mediaMetadata,
    } as MediaMetadata,
    language: "en-US",
  }
}

describe("resolveFanartUrl", () => {
  it("resolves TMDB tvshow fanart", async () => {
    const vars = buildVariables({
      type: "tvshow-folder",
      tvShow: { id: "123", database: "TMDB", name: "TV", seasons: [] },
    })
    const result = await resolveFanartUrl(vars, {
      getTvShowById: vi.fn().mockResolvedValue({ backdrop_path: "/tmdb-tv-backdrop.jpg" }),
      getMovieById: vi.fn(),
      getSeriesExtended: vi.fn(),
      getMovieExtended: vi.fn(),
      getArtworkTypes: vi.fn(),
    } as any)
    expect(result).toContain("/original/tmdb-tv-backdrop.jpg")
  })

  it("resolves TVDB tvshow fanart from background artwork type", async () => {
    const vars = buildVariables({
      type: "tvshow-folder",
      tvShow: { id: "321", database: "TVDB", name: "TV", seasons: [] },
    })
    const result = await resolveFanartUrl(vars, {
      getTvShowById: vi.fn(),
      getMovieById: vi.fn(),
      getSeriesExtended: vi.fn().mockResolvedValue({
        artworks: [
          { image: "https://tvdb/series-poster.jpg", type: 2, score: 1 },
          { image: "https://tvdb/series-background.jpg", type: 3, score: 10 },
        ],
      }),
      getMovieExtended: vi.fn(),
      getArtworkTypes: vi.fn().mockResolvedValue([
        { id: 2, name: "Poster", recordType: "series" },
        { id: 3, name: "Background", recordType: "series" },
      ]),
    } as any)
    expect(result).toBe("https://tvdb/series-background.jpg")
  })

  it("resolves TMDB movie fanart", async () => {
    const vars = buildVariables({
      type: "movie-folder",
      movie: { id: "456", database: "TMDB", name: "Movie" },
    })
    const result = await resolveFanartUrl(vars, {
      getTvShowById: vi.fn(),
      getMovieById: vi.fn().mockResolvedValue({ backdrop_path: "/tmdb-movie-backdrop.jpg" }),
      getSeriesExtended: vi.fn(),
      getMovieExtended: vi.fn(),
      getArtworkTypes: vi.fn(),
    } as any)
    expect(result).toContain("/original/tmdb-movie-backdrop.jpg")
  })

  it("resolves TVDB movie fanart from background artwork type", async () => {
    const vars = buildVariables({
      type: "movie-folder",
      movie: { id: "654", database: "TVDB", name: "Movie" },
    })
    const result = await resolveFanartUrl(vars, {
      getTvShowById: vi.fn(),
      getMovieById: vi.fn(),
      getSeriesExtended: vi.fn(),
      getMovieExtended: vi.fn().mockResolvedValue({
        artworks: [
          { image: "https://tvdb/movie-poster.jpg", type: 14, score: 3 },
          { image: "https://tvdb/movie-background.jpg", type: 15, score: 10 },
        ],
      }),
      getArtworkTypes: vi.fn().mockResolvedValue([
        { id: 14, name: "Poster", recordType: "movie" },
        { id: 15, name: "Background", recordType: "movie" },
      ]),
    } as any)
    expect(result).toBe("https://tvdb/movie-background.jpg")
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
    getMovieById: vi.fn().mockResolvedValue({ backdrop_path: "/fanart.jpg" }),
  }),
}))

vi.mock("@/hooks/useTvdbQueries", () => ({
  useTvdbQueries: () => ({
    getSeriesExtended: vi.fn(),
    getMovieExtended: vi.fn(),
    getArtworkTypes: vi.fn(),
  }),
}))

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

const fanartMovie: MediaMetadata = {
  type: "movie-folder",
  mediaFolderPath: "/media/Fight Club",
  movie: { id: "550", database: "TMDB", name: "Fight Club" },
} as MediaMetadata

describe("useScrapeFanartMutation wiring", () => {
  beforeEach(() => {
    mockDownloadScrapeImage.mockClear()
    useConfigValue = {
      ...defaultUserConfig,
      tmdb: { host: "https://api.themoviedb.org", apiKey: "", httpProxy: "http://proxy:8080" },
    }
  })

  it("passes the configured userConfig through to downloadScrapeImage", async () => {
    const { result } = renderHook(() => useScrapeFanartMutation(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ mediaMetadata: fanartMovie, language: "en-US" })

    expect(mockDownloadScrapeImage).toHaveBeenCalledTimes(1)
    const [md, url, path, uc] = mockDownloadScrapeImage.mock.calls[0] as [MediaMetadata, string, string, UserConfig]
    expect(md).toBe(fanartMovie)
    expect(url).toBe("https://image.tmdb.org/t/p/original/fanart.jpg")
    expect(path).toBe("/media/Fight Club/fanart.jpg")
    expect(uc).toBe(useConfigValue)
  })
})

