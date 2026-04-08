import { useCallback } from "react"
import type { MediaMetadata, TmdbSeasonDetails, TmdbSeriesDetails, TvShowMediaMetadata } from "@core/types"
import { NFO, buildEpisodeNfoXml, convertTvShowEpisodeNfoToXml, convertTvShowNfoToXml, type EpisodeNfo, type TvShowNFO } from "@/lib/nfo"
import { writeFile } from "@/api/writeFile"
import { getTMDBImageUrl } from "@/api/tmdb"
import { join, dirname, basename, extname, newFilePathWithExt } from "@/lib/path"
import { Path } from "@core/path"
import { toast } from "sonner"
import { isError, ExistedFileError } from "@core/errors"
import { useTranslation } from "@/lib/i18n"
import { useTmdbQueries } from "./useTmdbQueries"
import { useTvdbQueries } from "./useTvdbQueries"
import { useConfig } from "@/providers/config-provider"
import { useSeasonSectionState } from "@/components/hooks/useSeasonSectionState"
import Debug from 'debug'
import { isNotNil } from "es-toolkit"

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

export function useHandleScrapeStart() {
    const { t } = useTranslation('dialogs')

    const { getTvShowById, getTvShowSeasonDetails } = useTmdbQueries();
    const { getSeriesExtended } = useTvdbQueries();
    const { userConfig } = useConfig()

    const handleScrapeStart = useCallback(async (mediaMetadata: MediaMetadata) => {
        const fileAlreadyExistsMessage = t('errors.fileAlreadyExists' as any)
        try {

            if(mediaMetadata.type === 'tvshow-folder') {

                if(mediaMetadata.tvShow?.database === 'TMDB') {
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
                    const tvShow = await getSeriesExtended(parseInt(mediaMetadata.tvShow.id))
                    // TODO: translate tvShow in TVDB
                    
                } else {
                    console.error("Scrape start skipped: unsupported database " + mediaMetadata.tvShow?.database)
                    return;
                }

                
            } else if(mediaMetadata.type === 'movie-folder') {
                // await startToGenerateMovieNfo(mediaMetadata, () => fileAlreadyExistsMessage)
            } else {
                console.error("Scrape start skipped: unsupported folder type " + mediaMetadata.type)
                return;
            }
            
        } catch (error) {
            console.error("Scrape start error:", error)
            throw error // Re-throw so the task handler can mark the task as failed
        }
    }, [t])

    return handleScrapeStart
}
