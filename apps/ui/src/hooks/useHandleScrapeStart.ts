import { useCallback } from "react"
import type { MediaMetadata, TmdbMovieDetails, TmdbSeasonDetails, TmdbSeriesDetails } from "@core/types"
import {
    convertMovieNfoToXml,
    convertTvShowEpisodeNfoToXml,
    convertTvShowNfoToXml,
    type EpisodeNfo,
    type MovieNFO,
    type TvShowNFO,
} from "@/lib/nfo"
import { writeFile } from "@/api/writeFile"
import { getMovieById, getTMDBImageUrl } from "@/api/tmdb"
import { join, newFilePathWithExt } from "@/lib/path"
import { Path } from "@core/path"
import { useTranslation } from "@/lib/i18n"
import { useTmdbQueries } from "./useTmdbQueries"
import { useTvdbQueries } from "./useTvdbQueries"
import { useConfig } from "@/providers/config-provider"
import Debug from 'debug'
import { isNotNil } from "es-toolkit"
import type {
    TVDBv4MovieBaseRecord,
    TVDBv4SeriesExtendedResponse,
    TVDBv4SeriesSeasonsExtendedResponse,
} from "@smm/tvdb4/types"
import { getTVDBv4Client, mapToTvdbLangCode } from "@/lib/TvdbUtils"

const debug = Debug('scrape')

export function buildTvShowNfo(tmdbTvSeriesDetails: TmdbSeriesDetails, tmdbTvShowSeasons: TmdbSeasonDetails[]): TvShowNFO {
    const thumbs: TvShowNFO["thumbs"] = []
    const namedSeasons: TvShowNFO["namedSeasons"] = []

    const poster = getTMDBImageUrl(tmdbTvSeriesDetails.poster_path, "original")
    if (poster) {
        thumbs.push({
            url: poster,
            aspect: "poster",
        })
    }

    const clearLogo = getTMDBImageUrl((tmdbTvSeriesDetails as any).logo_path, "original")
    if (clearLogo) {
        thumbs.push({
            url: clearLogo,
            aspect: "clearlogo",
        })
    }

    for (const season of tmdbTvShowSeasons ?? []) {
        namedSeasons.push({
            number: season.season_number,
            name: season.name,
        })
        const seasonPoster = getTMDBImageUrl(season.poster_path, "original")
        if (seasonPoster) {
            thumbs.push({
                url: seasonPoster,
                aspect: "poster",
                season: season.season_number,
                type: "season",
            })
        }
    }

    const fanart = getTMDBImageUrl(tmdbTvSeriesDetails.backdrop_path, "original")
    const runtime =
        (tmdbTvShowSeasons ?? [])
            .flatMap((s) => s.episodes ?? [])
            .find((ep) => typeof ep.runtime === "number" && ep.runtime > 0)?.runtime

    return {
        title: tmdbTvSeriesDetails.name,
        originalTitle: tmdbTvSeriesDetails.original_name,
        showTitle: tmdbTvSeriesDetails.name,
        year: parseInt(tmdbTvSeriesDetails.first_air_date?.slice(0, 4) ?? "", 10) || undefined,
        top250: 0,
        ratings: [
            {
                default: true,
                max: 10,
                name: "themoviedb",
                value: tmdbTvSeriesDetails.vote_average,
                votes: tmdbTvSeriesDetails.vote_count,
            },
        ],
        userRating: 0,
        outline: tmdbTvSeriesDetails.overview,
        plot: tmdbTvSeriesDetails.overview,
        tagline: undefined,
        runtime,
        thumbs: thumbs.length > 0 ? thumbs : undefined,
        namedSeasons: namedSeasons.length > 0 ? namedSeasons : undefined,
        fanartThumbs: fanart ? [fanart] : undefined,
        episodeguide: JSON.stringify({ tmdb: String(tmdbTvSeriesDetails.id) }),
        id: String(tmdbTvSeriesDetails.id),
        tmdbid: String(tmdbTvSeriesDetails.id),
        uniqueIds: [
            {
                default: true,
                type: "tmdb",
                value: String(tmdbTvSeriesDetails.id),
            },
        ],
        premiered: tmdbTvSeriesDetails.first_air_date,
        status: tmdbTvSeriesDetails.status,
        watched: false,
        genres: (tmdbTvSeriesDetails as any).genres?.map((g: { name: string }) => g.name).filter(Boolean),
        studios: (tmdbTvSeriesDetails.production_companies ?? []).map((c) => c.name).filter(Boolean),
        countries: (tmdbTvSeriesDetails as any).production_countries?.map((c: { name: string }) => c.name).filter(Boolean),
        dateadded: new Date().toISOString().slice(0, 19).replace("T", " "),
    }
}

export function buildMovieNfo(tmdbMovieDetails: TmdbMovieDetails): MovieNFO {
    const thumbs: MovieNFO["thumbs"] = []
    const poster = getTMDBImageUrl(tmdbMovieDetails.poster_path, "original")
    if (poster) {
        thumbs.push({
            url: poster,
            aspect: "poster",
        })
    }
    const fanart = getTMDBImageUrl(tmdbMovieDetails.backdrop_path, "original")
    const imdbId = tmdbMovieDetails.imdb_id ?? undefined
    const uniqueIds: MovieNFO["uniqueIds"] = [
        {
            default: true,
            type: "tmdb",
            value: String(tmdbMovieDetails.id),
        },
    ]
    if (imdbId) {
        uniqueIds.push({
            default: false,
            type: "imdb",
            value: imdbId,
        })
    }
    return {
        title: tmdbMovieDetails.title,
        originalTitle: tmdbMovieDetails.original_title,
        sortTitle: tmdbMovieDetails.title,
        year: parseInt(tmdbMovieDetails.release_date?.slice(0, 4) ?? "", 10) || undefined,
        ratings: [
            {
                default: true,
                max: 10,
                name: "themoviedb",
                value: tmdbMovieDetails.vote_average,
                votes: tmdbMovieDetails.vote_count,
            },
        ],
        userRating: 0,
        top250: 0,
        set: tmdbMovieDetails.belongs_to_collection?.name
            ? {
                name: tmdbMovieDetails.belongs_to_collection.name,
                overview: tmdbMovieDetails.belongs_to_collection.name,
            }
            : undefined,
        plot: tmdbMovieDetails.overview,
        outline: tmdbMovieDetails.overview,
        tagline: tmdbMovieDetails.tagline ?? undefined,
        runtime: tmdbMovieDetails.runtime ?? undefined,
        thumbs: thumbs.length > 0 ? thumbs : undefined,
        fanartThumbs: fanart ? [fanart] : undefined,
        id: imdbId ?? String(tmdbMovieDetails.id),
        imdbid: imdbId,
        tmdbid: String(tmdbMovieDetails.id),
        uniqueIds,
        countries: (tmdbMovieDetails.production_countries ?? []).map((c) => c.name).filter(Boolean),
        status: tmdbMovieDetails.status || undefined,
        premiered: tmdbMovieDetails.release_date || undefined,
        watched: false,
        playcount: 0,
        genres: (tmdbMovieDetails.genres ?? []).map((g) => g.name).filter(Boolean),
        studios: (tmdbMovieDetails.production_companies ?? []).map((c) => c.name).filter(Boolean),
        languages:
            (tmdbMovieDetails.spoken_languages ?? [])
                .map((l) => l.name || l.english_name)
                .filter(Boolean)
                .join(" / ") || undefined,
        dateadded: new Date().toISOString().slice(0, 19).replace("T", " "),
    }
}

type TmdbEpisodeDetails = NonNullable<TmdbSeasonDetails["episodes"]>[number]

export function buildTvShowEpisodeNfo(
    tmdbTvSeriesDetails: TmdbSeriesDetails,
    tmdbSeason: TmdbSeasonDetails,
    tmdbEpisode: TmdbEpisodeDetails,
): EpisodeNfo {
    const thumb = getTMDBImageUrl(tmdbEpisode.still_path, "original") ?? undefined
    const studios =
        (tmdbTvSeriesDetails.production_companies ?? [])
            .map((company) => company.name)
            .filter(Boolean)

    const directors = (tmdbEpisode.crew ?? [])
        .filter((crew) => crew.job === "Director")
        .map((crew) => ({
            tmdbid: String(crew.id),
            name: crew.name,
        }))

    const credits = (tmdbEpisode.crew ?? [])
        .filter((crew) => crew.department === "Writing")
        .map((crew) => ({
            tmdbid: String(crew.id),
            name: crew.name,
        }))

    const actors = (tmdbEpisode.guest_stars ?? [])
        .map((guest) => ({
            name: guest.name,
            role: guest.character,
            thumb: getTMDBImageUrl(guest.profile_path, "original") ?? undefined,
            profile: `https://www.themoviedb.org/person/${guest.id}`,
            type: "GuestStar",
            tmdbid: String(guest.id),
        }))

    return {
        id: String(tmdbEpisode.id),
        title: tmdbEpisode.name,
        originalTitle: tmdbEpisode.name,
        showTitle: tmdbTvSeriesDetails.name,
        season: tmdbSeason.season_number,
        episode: tmdbEpisode.episode_number,
        uniqueIds: [
            {
                default: true,
                type: "tmdb",
                value: String(tmdbEpisode.id),
            },
        ],
        ratings:
            tmdbEpisode.vote_average > 0 || tmdbEpisode.vote_count > 0
                ? [
                    {
                        default: false,
                        max: 10,
                        name: "themoviedb",
                        value: tmdbEpisode.vote_average,
                        votes: tmdbEpisode.vote_count,
                    },
                ]
                : undefined,
        userRating: 0,
        plot: tmdbEpisode.overview,
        runtime: tmdbEpisode.runtime > 0 ? tmdbEpisode.runtime : undefined,
        thumb,
        premiered: tmdbEpisode.air_date,
        aired: tmdbEpisode.air_date,
        watched: false,
        playcount: 0,
        studios: studios.length > 0 ? studios : undefined,
        credits: credits.length > 0 ? credits : undefined,
        directors: directors.length > 0 ? directors : undefined,
        actors: actors.length > 0 ? actors : undefined,
        dateadded: new Date().toISOString().slice(0, 19).replace("T", " "),
    }
}

type TvdbSeriesDetails = TVDBv4SeriesExtendedResponse
type TvdbSeasonDetails = TVDBv4SeriesSeasonsExtendedResponse
type TvdbEpisodeDetails = TVDBv4SeriesSeasonsExtendedResponse["episodes"][number]
type TvdbMovieDetails = TVDBv4MovieBaseRecord

function tvdbGetString(data: Record<string, unknown>, key: string): string | undefined {
    const value = data[key]
    return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

function tvdbGetNumber(data: Record<string, unknown>, key: string): number | undefined {
    const value = data[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : undefined
    }
    return undefined
}

export function buildTvShowNfoByTVDB(
    tvdbSeries: TvdbSeriesDetails,
    tvdbSeasons: TvdbSeasonDetails[],
    resolvedSeriesText?: { title?: string; overview?: string },
): TvShowNFO {
    const getSeasonNumber = (season: TvdbSeasonDetails): number | undefined =>
        season.episodes?.find((ep) => Number.isFinite(ep.seasonNumber))?.seasonNumber

    const thumbs: TvShowNFO["thumbs"] = []
    const namedSeasons: TvShowNFO["namedSeasons"] = (tvdbSeasons ?? []).map((season) => ({
        number: getSeasonNumber(season),
        name: "",
    }))

    if (tvdbSeries.image) {
        thumbs.push({
            url: tvdbSeries.image,
            aspect: "poster",
        })
    }
    for (const season of tvdbSeasons ?? []) {
        const seasonNumber = getSeasonNumber(season)
        if (season.image) {
            thumbs.push({
                url: season.image,
                aspect: "poster",
                season: seasonNumber,
                type: "season",
            })
        }
    }

    const fanartThumb = (tvdbSeries.artworks ?? [])
        .filter((art) => typeof art.image === "string" && art.image.length > 0)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.image

    return {
        id: String(tvdbSeries.id),
        title: resolvedSeriesText?.title || tvdbSeries.name,
        originalTitle: resolvedSeriesText?.title || tvdbSeries.name,
        showTitle: resolvedSeriesText?.title || tvdbSeries.name,
        year: parseInt(tvdbSeries.year ?? "", 10) || undefined,
        top250: 0,
        ratings:
            tvdbSeries.score > 0
                ? [
                    {
                        default: true,
                        max: 10,
                        name: "tvdb",
                        value: tvdbSeries.score,
                    },
                ]
                : undefined,
        userRating: 0,
        outline: resolvedSeriesText?.overview || tvdbSeries.overview,
        plot: resolvedSeriesText?.overview || tvdbSeries.overview,
        runtime: tvdbSeries.averageRuntime > 0 ? tvdbSeries.averageRuntime : undefined,
        thumbs: thumbs.length > 0 ? thumbs : undefined,
        namedSeasons: namedSeasons.length > 0 ? namedSeasons : undefined,
        fanartThumbs: fanartThumb ? [fanartThumb] : undefined,
        episodeguide: JSON.stringify({ tvdb: String(tvdbSeries.id) }),
        tvdbid: String(tvdbSeries.id),
        uniqueIds: [
            {
                default: true,
                type: "tvdb",
                value: String(tvdbSeries.id),
            },
        ],
        premiered: tvdbSeries.firstAired,
        status: tvdbSeries.status?.name,
        watched: false,
        playcount: 0,
        countries: tvdbSeries.originalCountry ? [tvdbSeries.originalCountry] : undefined,
        dateadded: new Date().toISOString().slice(0, 19).replace("T", " "),
    }
}

export function buildTvShowEpisodeNfoByTVDB(
    tvdbSeries: TvdbSeriesDetails,
    tvdbSeason: TvdbSeasonDetails,
    tvdbEpisode: TvdbEpisodeDetails,
    episodeTranslationData?: Record<string, string>,
): EpisodeNfo {
    const translatedTitle =
        typeof episodeTranslationData?.name === "string" &&
        episodeTranslationData.name.trim().length > 0
            ? episodeTranslationData.name
            : tvdbEpisode.name
    const translatedOverview =
        typeof episodeTranslationData?.overview === "string" &&
        episodeTranslationData.overview.trim().length > 0
            ? episodeTranslationData.overview
            : tvdbEpisode.overview

    return {
        id: String(tvdbEpisode.id),
        title: translatedTitle,
        originalTitle: translatedTitle,
        showTitle: tvdbSeries.name,
        season: tvdbEpisode.seasonNumber,
        episode: tvdbEpisode.number,
        uniqueIds: [
            {
                default: true,
                type: "tvdb",
                value: String(tvdbEpisode.id),
            },
        ],
        ratings:
            tvdbSeries.score > 0
                ? [
                    {
                        default: false,
                        max: 10,
                        name: "tvdb",
                        value: tvdbSeries.score,
                    },
                ]
                : undefined,
        userRating: 0,
        plot: translatedOverview,
        runtime: tvdbEpisode.runtime > 0 ? tvdbEpisode.runtime : undefined,
        thumb: tvdbEpisode.image || undefined,
        premiered: tvdbEpisode.aired,
        aired: tvdbEpisode.aired,
        watched: false,
        playcount: 0,
        dateadded: new Date().toISOString().slice(0, 19).replace("T", " "),
    }
}

export function buildMovieNfoByTVDB(
    tvdbMovie: TvdbMovieDetails,
    resolvedMovieText?: { title?: string; overview?: string },
): MovieNFO {
    const data = tvdbMovie as Record<string, unknown>
    const title = resolvedMovieText?.title || tvdbGetString(data, "name")
    const overview = resolvedMovieText?.overview || tvdbGetString(data, "overview")
    const image = tvdbGetString(data, "image")
    const score = tvdbGetNumber(data, "score")
    const yearText = tvdbGetString(data, "year")
    const year = yearText ? parseInt(yearText, 10) || undefined : undefined
    const releaseDate = tvdbGetString(data, "releaseDate") ?? tvdbGetString(data, "first_release")
    const runtime = tvdbGetNumber(data, "runtime")
    const statusText =
        typeof data.status === "object" && data.status !== null
            ? tvdbGetString(data.status as Record<string, unknown>, "name")
            : undefined

    return {
        title,
        originalTitle: title,
        year,
        ratings:
            score && score > 0
                ? [
                    {
                        default: true,
                        max: 10,
                        name: "tvdb",
                        value: score,
                    },
                ]
                : undefined,
        userRating: 0,
        top250: 0,
        plot: overview,
        outline: overview,
        runtime: runtime && runtime > 0 ? runtime : undefined,
        thumbs: image
            ? [
                {
                    url: image,
                    aspect: "poster",
                },
            ]
            : undefined,
        id: String(tvdbMovie.id ?? ""),
        tvdbid: String(tvdbMovie.id ?? ""),
        uniqueIds: tvdbMovie.id
            ? [
                {
                    default: true,
                    type: "tvdb",
                    value: String(tvdbMovie.id),
                },
            ]
            : undefined,
        status: statusText,
        premiered: releaseDate,
        watched: false,
        playcount: 0,
        dateadded: new Date().toISOString().slice(0, 19).replace("T", " "),
    }
}

export function useHandleScrapeStart() {
    const { t } = useTranslation('dialogs')

    const { getTvShowById, getTvShowSeasonDetails } = useTmdbQueries();
    const { getSeriesExtended, getSeasonExtended } = useTvdbQueries();
    const { userConfig } = useConfig()

    const handleScrapeStart = useCallback(async (mediaMetadata: MediaMetadata) => {
        const fileAlreadyExistsMessage = t('errors.fileAlreadyExists' as any)
        try {

            if(mediaMetadata.type === 'tvshow-folder') {

                if(mediaMetadata.tvShow?.database === 'TMDB') {

                    console.log(`start to scrape TV show nfo files from TMDB: preferMediaLanguage=${userConfig.preferMediaLanguage}`)

                    const tmdbSeriesId = parseInt(mediaMetadata.tvShow.id);

                    debug(`collecting TV series and seasons data from TMDB`)
                    const tmdbTvSeriesDetails: TmdbSeriesDetails = await getTvShowById(tmdbSeriesId, userConfig.preferMediaLanguage)
                    const tmdbTvShowSeasons: TmdbSeasonDetails[] = await Promise.all(tmdbTvSeriesDetails
                        .seasons.map(season => season.season_number)
                        .map(seasonNumber => getTvShowSeasonDetails(tmdbSeriesId, seasonNumber, userConfig.preferMediaLanguage)))
                    debug(`collected TV series and seasons data from TMDB`)

                    const tvShowNfo: TvShowNFO = buildTvShowNfo(tmdbTvSeriesDetails, tmdbTvShowSeasons)
                    debug(`built XML for tvshow.nfo`)
                    const tvShwoNfoXml = convertTvShowNfoToXml(tvShowNfo)
                    const tvShowNfoPath = join(Path.toPlatformPath(mediaMetadata.mediaFolderPath!), "tvshow.nfo")
                    debug(`writing tvshow.nfo to ${tvShowNfoPath}`)
                    await writeFile(tvShowNfoPath, tvShwoNfoXml)
                    debug(`wrote tvshow.nfo to ${tvShowNfoPath}`)


                    await Promise.all(mediaMetadata.mediaFiles?.map(async (mediaFile) => {
                        const { seasonNumber, episodeNumber, absolutePath } = mediaFile
                        const tmdbSeason = tmdbTvShowSeasons.find(i => i.season_number === seasonNumber);
                        const tmdbEpisode = tmdbSeason?.episodes?.find(i => i.episode_number === episodeNumber);

                        if(tmdbSeason === undefined || tmdbEpisode === undefined) {
                            debug(`skipping episode ${seasonNumber}x${episodeNumber} because it is not found in TMDB: ${tmdbSeason} ${tmdbEpisode}`)
                            return undefined;
                        }

                        const episodeNfo: EpisodeNfo = buildTvShowEpisodeNfo(tmdbTvSeriesDetails, tmdbSeason, tmdbEpisode)
                        debug(`build episodeNfo for episode ${seasonNumber}x${episodeNumber}`)
                        const episodeNfoXml = convertTvShowEpisodeNfoToXml(episodeNfo)
                        const episodeNfoPath = newFilePathWithExt(absolutePath, ".nfo")
                        debug(`writing episode ${seasonNumber}x${episodeNumber} nfo to ${episodeNfoPath}`)
                        await writeFile(Path.toPlatformPath(episodeNfoPath), episodeNfoXml)
                        debug(`wrote episode ${seasonNumber}x${episodeNumber} nfo to ${episodeNfoPath}`)
                        return;
                    })
                    .filter(isNotNil) ?? [])
                    debug(`all episode nfo files written`)

                    
                } else if(mediaMetadata.tvShow?.database === 'TVDB') {

                    console.log(`start to scrape TV show nfo files from TVDB: preferMediaLanguage=${userConfig.preferMediaLanguage}`)

                    const tvdbSeriesId = parseInt(mediaMetadata.tvShow.id)
                    const preferLang = userConfig.preferMediaLanguage ?? "en-US"
                    const tvdbLangCode = mapToTvdbLangCode(preferLang)
                    const tvdb = getTVDBv4Client()
                    debug(`collecting TV series and seasons data from TVDB`)
                    const tvdbSeries = await getSeriesExtended(tvdbSeriesId)
                    if (!tvdbSeries) {
                        throw new Error(`Failed to fetch TVDB series: ${tvdbSeriesId}`)
                    }
                    const tvdbSeasons = (await Promise.all(
                        (tvdbSeries.seasons ?? []).map((s) => getSeasonExtended(s.id)),
                    )).filter(isNotNil)
                    debug(`collected TV series and seasons data from TVDB`)

                    const seriesTranslation = await tvdb.seriesTranslationByLangCode(tvdbSeriesId, tvdbLangCode)
                    const resolvedSeriesText = {
                        title:
                            seriesTranslation.status === "success" &&
                            typeof seriesTranslation.data.name === "string" &&
                            seriesTranslation.data.name.trim().length > 0
                                ? seriesTranslation.data.name
                                : tvdbSeries.name,
                        overview:
                            seriesTranslation.status === "success" &&
                            typeof seriesTranslation.data.overview === "string" &&
                            seriesTranslation.data.overview.trim().length > 0
                                ? seriesTranslation.data.overview
                                : tvdbSeries.overview,
                    }

                    const tvShowNfo: TvShowNFO = buildTvShowNfoByTVDB(tvdbSeries, tvdbSeasons, resolvedSeriesText)
                    const tvShowNfoXml = convertTvShowNfoToXml(tvShowNfo)
                    const tvShowNfoPath = join(Path.toPlatformPath(mediaMetadata.mediaFolderPath!), "tvshow.nfo")
                    debug(`writing tvshow.nfo to ${tvShowNfoPath}`)
                    await writeFile(tvShowNfoPath, tvShowNfoXml)
                    debug(`wrote tvshow.nfo to ${tvShowNfoPath}`)

                    await Promise.all(mediaMetadata.mediaFiles?.map(async (mediaFile) => {
                        const { seasonNumber, episodeNumber, absolutePath } = mediaFile
                        const tvdbSeason = tvdbSeasons.find((s) =>
                            (s.episodes ?? []).some((e) => e.seasonNumber === Number(seasonNumber)),
                        )
                        const tvdbEpisode = tvdbSeason?.episodes?.find((e) => e.number === Number(episodeNumber))

                        if(!tvdbSeason || !tvdbEpisode) {
                            debug(`skipping TVDB episode ${seasonNumber}x${episodeNumber}: not found`)
                            return undefined
                        }

                        let episodeTranslationData: Record<string, string> | undefined
                        try {
                            const episodeTranslationResponse = await tvdb.episodeTranslationByLangCode(tvdbEpisode.id, tvdbLangCode)
                            if (episodeTranslationResponse.status === "success") {
                                episodeTranslationData = episodeTranslationResponse.data
                                debug(`collected episode translation data for ${tvdbEpisode.id}: ${JSON.stringify(episodeTranslationData)}`)
                            } else {
                                debug(`failed to collect translation data for S${seasonNumber}E${episodeNumber}: ${episodeTranslationResponse.message}`)
                            }
                        } catch (e) {
                            debug(`TVDB episode translation failed for ${tvdbEpisode.id}: ${e}`)
                        }

                        const episodeNfo: EpisodeNfo = buildTvShowEpisodeNfoByTVDB(
                            tvdbSeries,
                            tvdbSeason,
                            tvdbEpisode,
                            episodeTranslationData,
                        )
                        const episodeNfoXml = convertTvShowEpisodeNfoToXml(episodeNfo)
                        const episodeNfoPath = newFilePathWithExt(absolutePath, ".nfo")
                        debug(`writing TVDB episode ${seasonNumber}x${episodeNumber} nfo to ${episodeNfoPath}`)
                        await writeFile(Path.toPlatformPath(episodeNfoPath), episodeNfoXml)
                        debug(`wrote TVDB episode ${seasonNumber}x${episodeNumber} nfo to ${episodeNfoPath}`)
                        return
                    })
                    .filter(isNotNil) ?? [])
                    debug(`all TVDB episode nfo files written`)
                } else {
                    console.error("Scrape start skipped: unsupported database " + mediaMetadata.tvShow?.database)
                    return;
                }

                
            } else if(mediaMetadata.type === 'movie-folder') {
                if(mediaMetadata.movie?.database === 'TMDB') {
                    console.log(`start to scrape movie nfo from TMDB: preferMediaLanguage=${userConfig.preferMediaLanguage}`)
                    const tmdbMovieId = parseInt(mediaMetadata.movie.id)
                    const tmdbMovieDetails: TmdbMovieDetails = await getMovieById(tmdbMovieId, userConfig.preferMediaLanguage)
                    const movieNfo: MovieNFO = buildMovieNfo(tmdbMovieDetails)
                    const movieNfoXml = convertMovieNfoToXml(movieNfo)
                    const movieNfoPath = join(Path.toPlatformPath(mediaMetadata.mediaFolderPath!), "movie.nfo")
                    debug(`writing movie.nfo to ${movieNfoPath}`)
                    await writeFile(movieNfoPath, movieNfoXml)
                    debug(`wrote movie.nfo to ${movieNfoPath}`)
                } else if(mediaMetadata.movie?.database === 'TVDB') {
                    console.log(`start to scrape movie nfo from TVDB: preferMediaLanguage=${userConfig.preferMediaLanguage}`)
                    const tvdbMovieId = parseInt(mediaMetadata.movie.id)
                    const preferLang = userConfig.preferMediaLanguage ?? "en-US"
                    const tvdbLangCode = mapToTvdbLangCode(preferLang)
                    const tvdb = getTVDBv4Client()
                    const tvdbMovieResp = await tvdb.movieExtendedById(tvdbMovieId)
                    if (tvdbMovieResp.status !== "success") {
                        throw new Error(`Failed to fetch TVDB movie: ${tvdbMovieId}`)
                    }
                    let resolvedMovieText: { title?: string; overview?: string } | undefined
                    try {
                        const movieTranslationResp = await tvdb.movieTranslationByLangCode(tvdbMovieId, tvdbLangCode)
                        if (movieTranslationResp.status === "success") {
                            resolvedMovieText = {
                                title:
                                    typeof movieTranslationResp.data.name === "string" &&
                                    movieTranslationResp.data.name.trim().length > 0
                                        ? movieTranslationResp.data.name
                                        : undefined,
                                overview:
                                    typeof movieTranslationResp.data.overview === "string" &&
                                    movieTranslationResp.data.overview.trim().length > 0
                                        ? movieTranslationResp.data.overview
                                        : undefined,
                            }
                        }
                    } catch (e) {
                        debug(`TVDB movie translation failed for ${tvdbMovieId}: ${e}`)
                    }
                    const movieNfo: MovieNFO = buildMovieNfoByTVDB(tvdbMovieResp.data, resolvedMovieText)
                    const movieNfoXml = convertMovieNfoToXml(movieNfo)
                    const movieNfoPath = join(Path.toPlatformPath(mediaMetadata.mediaFolderPath!), "movie.nfo")
                    debug(`writing movie.nfo to ${movieNfoPath}`)
                    await writeFile(movieNfoPath, movieNfoXml)
                    debug(`wrote movie.nfo to ${movieNfoPath}`)
                } else {
                    console.error("Scrape start skipped: unsupported movie database " + mediaMetadata.movie?.database)
                    return;
                }
            } else {
                console.error("Scrape start skipped: unsupported folder type " + mediaMetadata.type)
                return;
            }
            
        } catch (error) {
            console.error("Scrape start error:", error)
            throw error // Re-throw so the task handler can mark the task as failed
        }
    }, [t, userConfig.preferMediaLanguage])

    return handleScrapeStart
}
