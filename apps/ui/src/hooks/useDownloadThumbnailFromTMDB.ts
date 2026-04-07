import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import { useTmdbQueries } from "@/hooks/useTmdbQueries"
import { getTMDBImageUrl } from "@/api/tmdb"
import { downloadImageApi } from "@/api/downloadImage"
import { extname, newFilePathWithExt } from "@/lib/path"
import type { MediaFileMetadata } from "@core/types"

export interface DownloadThumbnailFromTMDBVariables {
  seriesId: number
  mediaFiles: MediaFileMetadata[]
}

export interface EpisodeStillPath {
  season: number
  episode: number
  stillPath: string
}

export function useDownloadThumbnailFromTMDB<TContext = unknown>(
  options?: Omit<
    UseMutationOptions<void, Error, DownloadThumbnailFromTMDBVariables, TContext>,
    "mutationFn"
  >
) {
  const { getTvShowById, getTvShowSeasonDetails } = useTmdbQueries()

  const getEpisodeStillPathsFromTMDB = async (seriesId: number): Promise<EpisodeStillPath[]> => {
    const tvshow = await getTvShowById(seriesId, 'en-US')

    const stillPaths: EpisodeStillPath[] = []

    for (const season of tvshow.seasons) {
      const tmdbSeason = await getTvShowSeasonDetails(seriesId, season.season_number, 'en-US')
      for (const episode of (tmdbSeason.episodes ?? [])) {
        if (episode.still_path === undefined) {
          continue
        }

        const stillImageURL = await getTMDBImageUrl(episode.still_path || '')

        if (stillImageURL === null) {
          continue
        }

        stillPaths.push({
          season: season.season_number,
          episode: episode.episode_number,
          stillPath: stillImageURL,
        })
      }
    }

    console.log(`Get still paths for episodes: `, stillPaths)
    return stillPaths
  }

  return useMutation({
    ...options,
    mutationFn: async (variables: DownloadThumbnailFromTMDBVariables) => {
      const { seriesId, mediaFiles } = variables
      const stillPaths = await getEpisodeStillPathsFromTMDB(seriesId)

      for (const mediaFile of mediaFiles) {
        const stillPath = stillPaths.find(
          (path) => path.season === mediaFile.seasonNumber && path.episode === mediaFile.episodeNumber
        )
        if (stillPath === undefined) {
          continue
        }
        const stillFilePath = newFilePathWithExt(mediaFile.absolutePath, extname(stillPath.stillPath))
        await downloadImageApi(stillPath.stillPath, stillFilePath)
      }
    },
  })
}
