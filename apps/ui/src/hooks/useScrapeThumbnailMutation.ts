import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import type { MediaMetadata } from "@core/types"
import { getMovieById } from "@/api/tmdb"
import { getTVDBv4Client, SMM_TVDB_DEFAULT_UPSTREAM } from "@/lib/TvdbUtils"
import { SMM_TMDB_DEFAULT_UPSTREAM } from "@/api/tmdb"
import { useDownloadThumbnailFromTMDB } from "./useDownloadThumbnailFromTMDB"
import { useDownloadThumbnailFromTVDB } from "./useDownloadThumbnailFromTVDB"
import { useConfig } from "./userConfig"

export interface ScrapeThumbnailMutationVariables {
  mediaMetadata: MediaMetadata
}

export function useScrapeThumbnailMutation<TContext = unknown>(
  options?: Omit<
    UseMutationOptions<void, Error, ScrapeThumbnailMutationVariables, TContext>,
    "mutationFn"
  >,
) {
  const downloadThumbnailFromTMDBMutation = useDownloadThumbnailFromTMDB()
  const downloadThumbnailFromTVDBMutation = useDownloadThumbnailFromTVDB()
  const { appConfig, userConfig } = useConfig()

  return useMutation({
    ...options,
    mutationFn: async ({ mediaMetadata }: ScrapeThumbnailMutationVariables) => {
      if (mediaMetadata.type === "tvshow-folder") {
        const tvShow = mediaMetadata.tvShow
        if (tvShow === undefined) {
          console.error("Thumbnail download skipped: TV show is undefined")
          return
        }

        if (tvShow.database === "TMDB") {
          const tvShowId = parseInt(tvShow.id, 10)
          await downloadThumbnailFromTMDBMutation.mutateAsync({
            seriesId: tvShowId,
            mediaFiles: mediaMetadata.mediaFiles ?? [],
          })
          return
        }
        if (tvShow.database === "TVDB") {
          const tvShowId = parseInt(tvShow.id, 10)
          await downloadThumbnailFromTVDBMutation.mutateAsync({
            seriesId: tvShowId,
            mediaFiles: mediaMetadata.mediaFiles ?? [],
          })
          return
        }
        console.warn("Thumbnail download skipped: unsupported database " + tvShow.database)
        return
      }

      if (mediaMetadata.type === "movie-folder") {
        const movie = mediaMetadata.movie
        if (movie === undefined) {
          console.error("Thumbnail download skipped: Movie is undefined")
          return
        }

        if (movie.database === "TMDB") {
          const movieId = parseInt(movie.id, 10)
          await getMovieById(movieId, "en-US", {
            reverseProxyUrl: appConfig.reverseProxyUrl,
            upstreamBaseURL: userConfig.tmdb?.host?.trim() || SMM_TMDB_DEFAULT_UPSTREAM,
            apiKey: userConfig.tmdb?.apiKey?.trim() || undefined,
          })
          // TODO: implement movie thumbnail scraping
          return
        }
        if (movie.database === "TVDB") {
          const movieId = parseInt(movie.id, 10)
          const tvdb = getTVDBv4Client({
            reverseProxyUrl: appConfig.reverseProxyUrl,
            upstreamBaseURL: userConfig.tvdb?.host?.trim() || SMM_TVDB_DEFAULT_UPSTREAM,
            apiKey: userConfig.tvdb?.apiKey?.trim() || undefined,
          })
          await tvdb.movieExtendedById(movieId)
          // TODO: implement movie thumbnail scraping
          return
        }
        console.warn("Thumbnail download skipped: unsupported database " + movie.database)
        return
      }

      console.warn("Thumbnail download skipped: unsupported folder type " + mediaMetadata.type)
    },
  })
}

