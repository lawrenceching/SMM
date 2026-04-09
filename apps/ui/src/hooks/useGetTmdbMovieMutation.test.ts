import { describe, expect, it } from "vitest"
import { buildMovieMediaMetadata } from "./useGetTmdbMovieMutation"
import type { TmdbMovieDetails } from "@core/types"

function createMockMovieDetails(overrides: Partial<TmdbMovieDetails> = {}): TmdbMovieDetails {
  return {
    id: 999,
    title: "Localized Title",
    original_title: "Original Title",
    overview: "Overview",
    poster_path: "/p.jpg",
    backdrop_path: "/b.jpg",
    release_date: "2024-06-01",
    vote_average: 7,
    vote_count: 10,
    popularity: 1,
    genre_ids: [],
    adult: false,
    video: false,
    belongs_to_collection: null,
    budget: 0,
    genres: [],
    homepage: null,
    imdb_id: null,
    original_language: "en",
    production_companies: [],
    production_countries: [],
    revenue: 0,
    runtime: 90,
    spoken_languages: [],
    status: "Released",
    tagline: null,
    ...overrides,
  }
}

describe("buildMovieMediaMetadata", () => {
  it("maps TMDB movie details to MovieMediaMetadata", () => {
    const details = createMockMovieDetails()
    expect(buildMovieMediaMetadata(details)).toEqual({
      id: "999",
      name: "Localized Title",
      airDate: "2024-06-01",
      database: "TMDB",
    })
  })

  it("falls back to original_title when title is empty", () => {
    const details = createMockMovieDetails({ title: "", original_title: "Only Original" })
    expect(buildMovieMediaMetadata(details)).toMatchObject({
      id: "999",
      name: "Only Original",
      airDate: "2024-06-01",
      database: "TMDB",
    })
  })
})
