import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
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
import { join, newFilePathWithExt } from "@/lib/path"
import { Path } from "@core/path"
import { useTmdbQueries } from "./useTmdbQueries"
import { useTvdbQueries } from "./useTvdbQueries"
import { useResolvedLanguages } from "@/hooks/useResolvedLanguages"
import Debug from "debug"
import { isNotNil } from "es-toolkit"
import type {
  TVDBv4MovieBaseRecord,
  TVDBv4SeriesExtendedResponse,
  TVDBv4SeriesSeasonsExtendedResponse,
} from "@smm/tvdb4/types"
import { mapToTvdbLangCode } from "@/lib/TvdbUtils"
import {
  buildMovieNfo,
  buildMovieNfoByTVDB,
  buildTvShowEpisodeNfo,
  buildTvShowEpisodeNfoByTVDB,
  buildTvShowNfo,
  buildTvShowNfoByTVDB,
} from "./useHandleScrapeStart"

const debug = Debug("scrape")

type TvdbSeriesDetails = TVDBv4SeriesExtendedResponse
type TvdbSeasonDetails = TVDBv4SeriesSeasonsExtendedResponse
type TvdbEpisodeDetails = TVDBv4SeriesSeasonsExtendedResponse["episodes"][number]
type TvdbMovieDetails = TVDBv4MovieBaseRecord

export interface ScrapeNfoMutationVariables {
  mediaMetadata: MediaMetadata
}

export function useScrapeNfoMutation<TContext = unknown>(
  options?: Omit<
    UseMutationOptions<void, Error, ScrapeNfoMutationVariables, TContext>,
    "mutationFn"
  >,
) {
  const { getTvShowById, getTvShowSeasonDetails, getMovieById } = useTmdbQueries()
  const {
    getSeriesExtended,
    getSeasonExtended,
    getMovieExtended,
    getSeriesTranslationByLangCode,
    getEpisodeTranslationByLangCode,
    getMovieTranslationByLangCode,
  } = useTvdbQueries()
  const { mediaLanguage } = useResolvedLanguages()

  return useMutation({
    ...options,
    mutationFn: async ({ mediaMetadata }: ScrapeNfoMutationVariables) => {
      if (mediaMetadata.type === "tvshow-folder") {
        if (mediaMetadata.tvShow?.database === "TMDB") {
          debug(`start to scrape TV show nfo files from TMDB: mediaLanguage=${mediaLanguage}`)
          const tmdbSeriesId = parseInt(mediaMetadata.tvShow.id, 10)
          const tmdbTvSeriesDetails: TmdbSeriesDetails = await getTvShowById(
            tmdbSeriesId,
            mediaLanguage,
          )
          const tmdbTvShowSeasons: TmdbSeasonDetails[] = await Promise.all(
            tmdbTvSeriesDetails.seasons
              .map((season) => season.season_number)
              .map((seasonNumber) =>
                getTvShowSeasonDetails(tmdbSeriesId, seasonNumber, mediaLanguage),
              ),
          )

          const tvShowNfo: TvShowNFO = buildTvShowNfo(tmdbTvSeriesDetails, tmdbTvShowSeasons)
          const tvShowNfoXml = convertTvShowNfoToXml(tvShowNfo)
          const tvShowNfoPath = join(Path.toPlatformPath(mediaMetadata.mediaFolderPath!), "tvshow.nfo")
          await writeFile(tvShowNfoPath, tvShowNfoXml)

          await Promise.all(
            mediaMetadata.mediaFiles
              ?.map(async (mediaFile) => {
                const { seasonNumber, episodeNumber, absolutePath } = mediaFile
                const tmdbSeason = tmdbTvShowSeasons.find((i) => i.season_number === seasonNumber)
                const tmdbEpisode = tmdbSeason?.episodes?.find((i) => i.episode_number === episodeNumber)
                if (tmdbSeason === undefined || tmdbEpisode === undefined) return undefined

                const episodeNfo: EpisodeNfo = buildTvShowEpisodeNfo(tmdbTvSeriesDetails, tmdbSeason, tmdbEpisode)
                const episodeNfoXml = convertTvShowEpisodeNfoToXml(episodeNfo)
                const episodeNfoPath = newFilePathWithExt(absolutePath, ".nfo")
                await writeFile(Path.toPlatformPath(episodeNfoPath), episodeNfoXml)
                return undefined
              })
              .filter(isNotNil) ?? [],
          )
          return
        }

        if (mediaMetadata.tvShow?.database === "TVDB") {
          debug(`start to scrape TV show nfo files from TVDB: mediaLanguage=${mediaLanguage}`)

          const tvdbSeriesId = parseInt(mediaMetadata.tvShow.id, 10)
          const tvdbLangCode = mapToTvdbLangCode(mediaLanguage)
          const tvdbSeries = await getSeriesExtended(tvdbSeriesId)
          if (!tvdbSeries) {
            throw new Error(`Failed to fetch TVDB series: ${tvdbSeriesId}`)
          }
          const tvdbSeasons = (
            await Promise.all((tvdbSeries.seasons ?? []).map((s) => getSeasonExtended(s.id)))
          ).filter(isNotNil)

          const seriesTranslation = await getSeriesTranslationByLangCode(tvdbSeriesId, tvdbLangCode)
          const resolvedSeriesText = {
            title:
              typeof seriesTranslation?.name === "string" &&
              seriesTranslation.name.trim().length > 0
                ? seriesTranslation.name
                : tvdbSeries.name,
            overview:
              typeof seriesTranslation?.overview === "string" &&
              seriesTranslation.overview.trim().length > 0
                ? seriesTranslation.overview
                : tvdbSeries.overview,
          }

          const tvShowNfo: TvShowNFO = buildTvShowNfoByTVDB(tvdbSeries, tvdbSeasons, resolvedSeriesText)
          const tvShowNfoXml = convertTvShowNfoToXml(tvShowNfo)
          const tvShowNfoPath = join(Path.toPlatformPath(mediaMetadata.mediaFolderPath!), "tvshow.nfo")
          await writeFile(tvShowNfoPath, tvShowNfoXml)

          await Promise.all(
            mediaMetadata.mediaFiles
              ?.map(async (mediaFile) => {
                const { seasonNumber, episodeNumber, absolutePath } = mediaFile
                const tvdbSeason = tvdbSeasons.find((s) =>
                  (s.episodes ?? []).some((e) => e.seasonNumber === Number(seasonNumber)),
                )
                const tvdbEpisode = tvdbSeason?.episodes?.find((e) => e.number === Number(episodeNumber))
                if (!tvdbSeason || !tvdbEpisode) return undefined

                let episodeTranslationData: Record<string, string> | undefined
                try {
                  episodeTranslationData = await getEpisodeTranslationByLangCode(
                    tvdbEpisode.id,
                    tvdbLangCode,
                  )
                } catch (e) {
                  debug(`TVDB episode translation failed for ${tvdbEpisode.id}: ${e}`)
                }

                const episodeNfo: EpisodeNfo = buildTvShowEpisodeNfoByTVDB(
                  tvdbSeries as TvdbSeriesDetails,
                  tvdbSeason as TvdbSeasonDetails,
                  tvdbEpisode as TvdbEpisodeDetails,
                  episodeTranslationData,
                )
                const episodeNfoXml = convertTvShowEpisodeNfoToXml(episodeNfo)
                const episodeNfoPath = newFilePathWithExt(absolutePath, ".nfo")
                await writeFile(Path.toPlatformPath(episodeNfoPath), episodeNfoXml)
                return undefined
              })
              .filter(isNotNil) ?? [],
          )
          return
        }

        console.error("Scrape start skipped: unsupported database " + mediaMetadata.tvShow?.database)
        return
      }

      if (mediaMetadata.type === "movie-folder") {
        if (mediaMetadata.movie?.database === "TMDB") {
          const tmdbMovieId = parseInt(mediaMetadata.movie.id, 10)
          const tmdbMovieDetails: TmdbMovieDetails = await getMovieById(
            tmdbMovieId,
            mediaLanguage,
          )
          const movieNfo: MovieNFO = buildMovieNfo(tmdbMovieDetails)
          const movieNfoXml = convertMovieNfoToXml(movieNfo)
          const movieNfoPath = join(Path.toPlatformPath(mediaMetadata.mediaFolderPath!), "movie.nfo")
          await writeFile(movieNfoPath, movieNfoXml)
          return
        }

        if (mediaMetadata.movie?.database === "TVDB") {
          const tvdbMovieId = parseInt(mediaMetadata.movie.id, 10)
          const tvdbLangCode = mapToTvdbLangCode(mediaLanguage)
          const tvdbMovie = await getMovieExtended(tvdbMovieId)
          if (!tvdbMovie) {
            throw new Error(`Failed to fetch TVDB movie: ${tvdbMovieId}`)
          }

          let resolvedMovieText: { title?: string; overview?: string } | undefined
          try {
            const movieTranslationResp = await getMovieTranslationByLangCode(tvdbMovieId, tvdbLangCode)
            if (movieTranslationResp) {
              resolvedMovieText = {
                title:
                  typeof movieTranslationResp.name === "string" && movieTranslationResp.name.trim().length > 0
                    ? movieTranslationResp.name
                    : undefined,
                overview:
                  typeof movieTranslationResp.overview === "string" &&
                  movieTranslationResp.overview.trim().length > 0
                    ? movieTranslationResp.overview
                    : undefined,
              }
            }
          } catch (e) {
            debug(`TVDB movie translation failed for ${tvdbMovieId}: ${e}`)
          }

          const movieNfo: MovieNFO = buildMovieNfoByTVDB(tvdbMovie as TvdbMovieDetails, resolvedMovieText)
          const movieNfoXml = convertMovieNfoToXml(movieNfo)
          const movieNfoPath = join(Path.toPlatformPath(mediaMetadata.mediaFolderPath!), "movie.nfo")
          await writeFile(movieNfoPath, movieNfoXml)
          return
        }

        console.error("Scrape start skipped: unsupported movie database " + mediaMetadata.movie?.database)
        return
      }

      console.error("Scrape start skipped: unsupported folder type " + mediaMetadata.type)
    },
  })
}

