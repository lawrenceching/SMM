import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import type { TmdbSeasonDetails, TmdbSeriesDetails } from "@core/types"
import type { TVDBv4SeriesExtendedResponse, TVDBv4SeriesSeasonsExtendedResponse } from "@smm/tvdb4/types"
import { buildTvShowEpisodeNfo, buildTvShowEpisodeNfoByTVDB, buildTvShowNfo, buildTvShowNfoByTVDB } from "./useHandleScrapeStart"

function resolveFixturePath(relativeFromRepoRoot: string): string {
    const candidates = [
        resolve(process.cwd(), relativeFromRepoRoot),
        resolve(process.cwd(), "../..", relativeFromRepoRoot),
    ]
    const matched = candidates.find((p) => existsSync(p))
    if (!matched) {
        throw new Error(`Fixture not found: ${relativeFromRepoRoot}. Tried: ${candidates.join(", ")}`)
    }
    return matched
}

async function readJsonFixture(relativeFromRepoRoot: string): Promise<string> {
    const fixturePath = resolveFixturePath(relativeFromRepoRoot)
    return readFile(fixturePath, "utf-8")
}

describe("buildTvShowNfo", () => {
    it("builds TvShowNFO from tmdb fixtures", async () => {
        const seriesText = await readJsonFixture("test/api/tmdb_series_details_example.json")
        const season0Text = await readJsonFixture("test/api/tmdb_tv_details_example_season0.json")
        const season1Text = await readJsonFixture("test/api/tmdb_tv_details_example_season1.json")

        const series = JSON.parse(seriesText) as TmdbSeriesDetails
        const season0 = JSON.parse(season0Text) as TmdbSeasonDetails
        const season1 = JSON.parse(season1Text) as TmdbSeasonDetails

        const nfo = buildTvShowNfo(series, [season0, season1])

        expect(nfo.title).toBe(series.name)
        expect(nfo.originalTitle).toBe(series.original_name)
        expect(nfo.showTitle).toBe(series.name)
        expect(nfo.id).toBe(String(series.id))
        expect(nfo.tmdbid).toBe(String(series.id))
        expect(nfo.episodeguide).toBe(JSON.stringify({ tmdb: String(series.id) }))
        expect(nfo.status).toBe(series.status)
        expect(nfo.premiered).toBe(series.first_air_date)
        expect(nfo.outline).toBe(series.overview)
        expect(nfo.plot).toBe(series.overview)
        expect(nfo.watched).toBe(false)
        expect(nfo.top250).toBe(0)
        expect(nfo.userRating).toBe(0)

        expect(nfo.ratings).toHaveLength(1)
        expect(nfo.ratings?.[0]).toMatchObject({
            default: true,
            max: 10,
            name: "themoviedb",
            value: series.vote_average,
            votes: series.vote_count,
        })

        expect(nfo.uniqueIds).toEqual([
            {
                default: true,
                type: "tmdb",
                value: String(series.id),
            },
        ])

        expect(nfo.namedSeasons).toEqual([
            { number: season0.season_number, name: season0.name },
            { number: season1.season_number, name: season1.name },
        ])

        expect(nfo.thumbs?.some((thumb) => thumb.aspect === "poster" && thumb.season === undefined)).toBe(true)
        expect(
            nfo.thumbs?.some(
                (thumb) =>
                    thumb.aspect === "poster" &&
                    thumb.season === season0.season_number &&
                    thumb.type === "season",
            ),
        ).toBe(true)
        expect(
            nfo.thumbs?.some(
                (thumb) =>
                    thumb.aspect === "poster" &&
                    thumb.season === season1.season_number &&
                    thumb.type === "season",
            ),
        ).toBe(true)

        const firstRuntime =
            [season0, season1]
                .flatMap((s) => s.episodes ?? [])
                .find((ep) => typeof ep.runtime === "number" && ep.runtime > 0)?.runtime
        expect(nfo.runtime).toBe(firstRuntime)

        expect(Array.isArray(nfo.studios)).toBe(true)
        expect(Array.isArray(nfo.genres) || nfo.genres === undefined).toBe(true)
        expect(typeof nfo.dateadded).toBe("string")
        expect(nfo.dateadded).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    })
})

describe("buildTvShowEpisodeNfo", () => {
    it("builds EpisodeNfo from tmdb fixtures", async () => {
        const seriesText = await readJsonFixture("test/api/tmdb_series_details_example.json")
        const season1Text = await readJsonFixture("test/api/tmdb_tv_details_example_season1.json")

        const series = JSON.parse(seriesText) as TmdbSeriesDetails
        const season1 = JSON.parse(season1Text) as TmdbSeasonDetails
        const episode = season1.episodes?.find((ep) => ep.episode_number === 1) ?? season1.episodes?.[0]
        expect(episode).toBeDefined()

        const nfo = buildTvShowEpisodeNfo(series, season1, episode!)

        expect(nfo.id).toBe(String(episode!.id))
        expect(nfo.title).toBe(episode!.name)
        expect(nfo.originalTitle).toBe(episode!.name)
        expect(nfo.showTitle).toBe(series.name)
        expect(nfo.season).toBe(season1.season_number)
        expect(nfo.episode).toBe(episode!.episode_number)
        expect(nfo.uniqueIds).toEqual([
            {
                default: true,
                type: "tmdb",
                value: String(episode!.id),
            },
        ])

        if (episode!.vote_average > 0 || episode!.vote_count > 0) {
            expect(nfo.ratings).toHaveLength(1)
            expect(nfo.ratings?.[0]).toMatchObject({
                name: "themoviedb",
                value: episode!.vote_average,
                votes: episode!.vote_count,
            })
        }

        expect(nfo.plot).toBe(episode!.overview)
        expect(nfo.runtime).toBe(episode!.runtime > 0 ? episode!.runtime : undefined)
        expect(nfo.premiered).toBe(episode!.air_date)
        expect(nfo.aired).toBe(episode!.air_date)
        expect(nfo.watched).toBe(false)
        expect(nfo.playcount).toBe(0)
        expect(nfo.studios).toEqual(series.production_companies.map((c) => c.name))
        expect(typeof nfo.dateadded).toBe("string")
        expect(nfo.dateadded).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    })

    it("omits ratings/runtime and optional arrays when data is empty", async () => {
        const seriesText = await readJsonFixture("test/api/tmdb_series_details_example.json")
        const season0Text = await readJsonFixture("test/api/tmdb_tv_details_example_season0.json")

        const series = JSON.parse(seriesText) as TmdbSeriesDetails
        const season0 = JSON.parse(season0Text) as TmdbSeasonDetails
        const baseEpisode = season0.episodes?.[0]
        expect(baseEpisode).toBeDefined()

        const episode = {
            ...baseEpisode!,
            vote_average: 0,
            vote_count: 0,
            runtime: 0,
            crew: [],
            guest_stars: [],
        }

        const nfo = buildTvShowEpisodeNfo(series, season0, episode)

        expect(nfo.ratings).toBeUndefined()
        expect(nfo.runtime).toBeUndefined()
        expect(nfo.actors).toBeUndefined()
        expect(nfo.directors).toBeUndefined()
        expect(nfo.credits).toBeUndefined()
    })
})

describe("TVDB nfo builders", () => {
    it("buildTvShowNfoByTVDB builds tvshow nfo with tvdbid", () => {
        const series: TVDBv4SeriesExtendedResponse = {
            id: 402412,
            name: "Komi Can't Communicate",
            image: "https://example.com/poster.jpg",
            nameTranslations: [],
            overviewTranslations: [],
            aliases: [],
            firstAired: "2021-10-07",
            lastAired: "2022-06-23",
            nextAired: "",
            score: 8.1,
            status: { id: 1, name: "Ended", recordType: "series", keepUpdated: false },
            originalCountry: "JPN",
            originalLanguage: "jpn",
            defaultSeasonType: 1,
            isOrderRandomized: false,
            lastUpdated: "",
            averageRuntime: 24,
            overview: "overview",
            year: "2021",
            artworks: [{ id: "1", image: "https://example.com/fanart.jpg", thumbnail: "", language: null, type: 0, score: 10, width: 0, height: 0, includesText: false, thumbnailWidth: 0, thumbnailHeight: 0, updatedAt: 0, status: { id: 1, name: null }, tagOptions: null }],
            seasons: [{ id: 1, seriesId: 402412, type: { id: 1, name: "Official", type: "official", alternateName: null }, number: 1, nameTranslations: [], overviewTranslations: [], image: "https://example.com/season1.jpg", imageType: 0, companies: { studio: null, network: null, production: null, distributor: null, special_effects: null }, lastUpdated: "" }],
        }
        const seasons: TVDBv4SeriesSeasonsExtendedResponse[] = [{
            id: 1,
            seriesId: 402412,
            type: { id: 1, name: "Official", type: "official", alternateName: null },
            image: "https://example.com/season1.jpg",
            imageType: 0,
            lastUpdated: "",
            year: "2021",
            episodes: [],
        }]

        const nfo = buildTvShowNfoByTVDB(series, seasons)
        expect(nfo.id).toBe("402412")
        expect(nfo.tvdbid).toBe("402412")
        expect(nfo.uniqueIds?.[0]).toMatchObject({ type: "tvdb", value: "402412", default: true })
        expect(nfo.episodeguide).toBe(JSON.stringify({ tvdb: "402412" }))
    })

    it("buildTvShowEpisodeNfoByTVDB builds episode nfo", () => {
        const series = {
            id: 402412,
            name: "Komi Can't Communicate",
            score: 8.1,
        } as TVDBv4SeriesExtendedResponse
        const season = {
            id: 1,
            seriesId: 402412,
            type: { id: 1, name: "Official", type: "official", alternateName: null },
            image: "",
            imageType: 0,
            lastUpdated: "",
            year: "2021",
            episodes: [],
        } as TVDBv4SeriesSeasonsExtendedResponse
        const episode = {
            id: 8415207,
            seriesId: 402412,
            name: "Episode 1",
            aired: "2021-10-07",
            runtime: 24,
            nameTranslations: [],
            overview: "overview",
            overviewTranslations: [],
            image: "https://example.com/ep.jpg",
            imageType: 0,
            lastUpdated: "",
            number: 1,
            absoluteNumber: 1,
            seasonNumber: 1,
            finaleType: null,
            year: "2021",
        }
        const nfo = buildTvShowEpisodeNfoByTVDB(series, season, episode)
        expect(nfo.id).toBe("8415207")
        expect(nfo.showTitle).toBe("Komi Can't Communicate")
        expect(nfo.season).toBe(1)
        expect(nfo.episode).toBe(1)
        expect(nfo.uniqueIds?.[0]).toMatchObject({ type: "tvdb", value: "8415207", default: true })
        expect(nfo.thumb).toBe("https://example.com/ep.jpg")
        expect(nfo.runtime).toBe(24)
    })
})

