import { describe, expect, it, vi } from "vitest"
import type { MediaMetadata } from "@core/types"
import { resolvePosterUrl, type ScrapePosterMutationVariables } from "./useScrapePosterMutation"

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

