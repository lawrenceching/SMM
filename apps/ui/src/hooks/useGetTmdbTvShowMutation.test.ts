import { describe, it, expect } from "vitest"
import { buildTvShowMediaMetadata } from "./useGetTmdbTvShowMutation"
import type {
  TmdbSeriesDetails,
  TmdbSeasonDetails,
  TmdbTvSeasonEpisodeDetails,
} from "@core/types"

function createMockSeriesDetails(overrides: Partial<TmdbSeriesDetails> = {}): TmdbSeriesDetails {
  return {
    id: 12345,
    name: "Test Show",
    original_name: "Test Show",
    overview: "A test show overview",
    poster_path: "/poster.jpg",
    backdrop_path: "/backdrop.jpg",
    first_air_date: "2024-01-01",
    vote_average: 8.5,
    vote_count: 100,
    popularity: 50.0,
    genre_ids: [1, 2],
    origin_country: ["US"],
    number_of_seasons: 2,
    number_of_episodes: 10,
    seasons: [],
    status: "Ended",
    type: "Scripted",
    in_production: false,
    last_air_date: "2024-06-01",
    networks: [],
    production_companies: [],
    ...overrides,
  }
}

function createMockSeasonDetails(
  seasonNumber: number,
  episodes: Partial<TmdbTvSeasonEpisodeDetails>[] = [],
): TmdbSeasonDetails {
  return {
    id: 100 + seasonNumber,
    name: `Season ${seasonNumber}`,
    overview: `Overview for season ${seasonNumber}`,
    poster_path: `/season${seasonNumber}.jpg`,
    season_number: seasonNumber,
    air_date: "2024-01-01",
    episode_count: episodes.length,
    episodes: episodes.map((ep, index) => ({
      id: 1000 + seasonNumber * 100 + index,
      name: ep.name ?? `Episode ${index + 1}`,
      overview: ep.overview ?? "",
      still_path: ep.still_path ?? null,
      air_date: ep.air_date ?? "2024-01-01",
      episode_number: ep.episode_number ?? index + 1,
      season_number: seasonNumber,
      vote_average: ep.vote_average ?? 0,
      vote_count: ep.vote_count ?? 0,
      runtime: ep.runtime ?? 45,
    })),
  } as TmdbSeasonDetails
}

describe("buildTvShowMediaMetadata", () => {
  it("maps basic series details to TvShowMediaMetadata", () => {
    const seriesDetails = createMockSeriesDetails()
    const seasonDetails: TmdbSeasonDetails[] = []

    const result = buildTvShowMediaMetadata(seriesDetails, seasonDetails)

    expect(result.id).toBe("12345")
    expect(result.name).toBe("Test Show")
    expect(result.database).toBe("TMDB")
    expect(result.airDate).toBe("2024-01-01")
    expect(result.seasons).toEqual([])
  })

  it("maps seasons with episodes correctly", () => {
    const seriesDetails = createMockSeriesDetails()
    const seasonDetails: TmdbSeasonDetails[] = [
      createMockSeasonDetails(1, [
        { name: "Pilot", episode_number: 1 },
        { name: "Episode 2", episode_number: 2 },
      ]),
      createMockSeasonDetails(2, [
        { name: "Season 2 Premiere", episode_number: 1 },
      ]),
    ]

    const result = buildTvShowMediaMetadata(seriesDetails, seasonDetails)

    expect(result.seasons).toHaveLength(2)
    
    expect(result.seasons[0].season).toBe(1)
    expect(result.seasons[0].name).toBe("Season 1")
    expect(result.seasons[0].episodes).toHaveLength(2)
    expect(result.seasons[0].episodes[0]).toEqual({
      season: 1,
      episode: 1,
      name: "Pilot",
    })
    expect(result.seasons[0].episodes[1]).toEqual({
      season: 1,
      episode: 2,
      name: "Episode 2",
    })

    expect(result.seasons[1].season).toBe(2)
    expect(result.seasons[1].name).toBe("Season 2")
    expect(result.seasons[1].episodes).toHaveLength(1)
    expect(result.seasons[1].episodes[0]).toEqual({
      season: 2,
      episode: 1,
      name: "Season 2 Premiere",
    })
  })

  it("handles empty episode name with fallback to empty string", () => {
    const seriesDetails = createMockSeriesDetails()
    const seasonDetails: TmdbSeasonDetails[] = [
      {
        ...createMockSeasonDetails(1, []),
        episodes: [
          {
            id: 1001,
            name: "",
            overview: "",
            still_path: null,
            air_date: "2024-01-01",
            episode_number: 1,
            season_number: 1,
            vote_average: 0,
            vote_count: 0,
            runtime: 45,
          },
          {
            id: 1002,
            name: undefined as unknown as string,
            overview: "",
            still_path: null,
            air_date: "2024-01-08",
            episode_number: 2,
            season_number: 1,
            vote_average: 0,
            vote_count: 0,
            runtime: 45,
          },
        ],
      } as TmdbSeasonDetails,
    ]

    const result = buildTvShowMediaMetadata(seriesDetails, seasonDetails)

    expect(result.seasons[0].episodes[0].name).toBe("")
    expect(result.seasons[0].episodes[1].name).toBe("")
  })

  it("handles empty season name with fallback to empty string", () => {
    const seriesDetails = createMockSeriesDetails()
    const seasonDetails: TmdbSeasonDetails[] = [
      {
        ...createMockSeasonDetails(1),
        name: "",
      },
    ]

    const result = buildTvShowMediaMetadata(seriesDetails, seasonDetails)

    expect(result.seasons[0].name).toBe("")
  })

  it("handles season with no episodes", () => {
    const seriesDetails = createMockSeriesDetails()
    const seasonDetails: TmdbSeasonDetails[] = [
      createMockSeasonDetails(1, []),
    ]

    const result = buildTvShowMediaMetadata(seriesDetails, seasonDetails)

    expect(result.seasons[0].episodes).toEqual([])
  })

  it("handles undefined episodes array", () => {
    const seriesDetails = createMockSeriesDetails()
    const seasonDetails: TmdbSeasonDetails[] = [
      {
        ...createMockSeasonDetails(1),
        episodes: undefined,
      } as unknown as TmdbSeasonDetails,
    ]

    const result = buildTvShowMediaMetadata(seriesDetails, seasonDetails)

    expect(result.seasons[0].episodes).toEqual([])
  })

  it("handles empty seasonDetails array", () => {
    const seriesDetails = createMockSeriesDetails()
    const seasonDetails: TmdbSeasonDetails[] = []

    const result = buildTvShowMediaMetadata(seriesDetails, seasonDetails)

    expect(result.seasons).toEqual([])
  })
})
