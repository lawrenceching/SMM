import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import { useTvdbQueries } from "@/hooks/useTvdbQueries"
import { downloadImageApi } from "@/api/downloadImage"
import { extname, newFilePathWithExt } from "@/lib/path"
import type { MediaFileMetadata } from "@core/types"
import Debug from 'debug'

const debug = Debug('useDownloadThumbnailFromTVDB')

export interface DownloadThumbnailFromTVDBVariables {
  seriesId: number
  mediaFiles: MediaFileMetadata[]
}

export interface EpisodeStillPath {
  season: number
  episode: number
  stillPath: string
}

export function useDownloadThumbnailFromTVDB<TContext = unknown>(
  options?: Omit<
    UseMutationOptions<void, Error, DownloadThumbnailFromTVDBVariables, TContext>,
    "mutationFn"
  >
) {
  const { getArtworkTypes, getSeriesExtended, getSeasonExtended } = useTvdbQueries()

  return useMutation({
    ...options,
    mutationFn: async (variables: DownloadThumbnailFromTVDBVariables) => {
      const { seriesId, mediaFiles } = variables

      const artworkTypes = await getArtworkTypes()
      if (artworkTypes === undefined) {
        console.error("Thumbnail download skipped: artwork types are undefined")
        return
      }
      console.log(`Get artwork types: `, artworkTypes)

      const screencapTypeId = artworkTypes.find((type) => type.name === '16:9 Screencap')?.id ?? 11

      const tvdbTvShow = await getSeriesExtended(seriesId)

      const stillPaths: EpisodeStillPath[] = []
      for (const season of tvdbTvShow?.seasons ?? []) {
        const tvdbSeason = await getSeasonExtended(season.id)
        for (const episode of tvdbSeason?.episodes ?? []) {
          if (episode.image === undefined) {
            continue
          }
          if (episode.imageType !== screencapTypeId) {
            continue
          }
          stillPaths.push({
            season: season.number,
            episode: episode.number,
            stillPath: episode.image,
          })
        }
      }

      console.log(`Get still paths for episodes: `, stillPaths)
      for (const mediaFile of mediaFiles) {
        const stillPath = stillPaths.find(
          (path) => path.season === mediaFile.seasonNumber && path.episode === mediaFile.episodeNumber
        )
        if (stillPath === undefined) {
          debug(`No still path found for episode S${mediaFile.seasonNumber?.toString().padStart(2, '0')}E${mediaFile.episodeNumber?.toString().padStart(2, '0')}`)
          continue
        }
        const stillFilePath = newFilePathWithExt(mediaFile.absolutePath, extname(stillPath.stillPath))
        debug(`started to download thumbnail for S${mediaFile.seasonNumber?.toString().padStart(2, '0')}E${mediaFile.episodeNumber?.toString().padStart(2, '0')}: ${stillPath.stillPath}`)
        await downloadImageApi(stillPath.stillPath, stillFilePath)
        debug(`downloaded thumbnail for S${mediaFile.seasonNumber?.toString().padStart(2, '0')}E${mediaFile.episodeNumber?.toString().padStart(2, '0')}: ${stillFilePath}`)
      }
    },
  })
}
