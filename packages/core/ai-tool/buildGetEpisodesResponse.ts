import { Path } from '../path'
import type { MediaMetadata } from '../types'
import type {
  GetEpisodesEpisode,
  GetEpisodesResponseData,
} from '../types/ai-tools/getEpisodes'

export function createEmptyGetEpisodesData(): GetEpisodesResponseData {
  return {
    episodes: [],
    totalCount: 0,
    showName: '',
    numberOfSeasons: 0,
  }
}

export function buildGetEpisodesResponse(
  metadata: MediaMetadata,
): GetEpisodesResponseData {
  const tvShow = metadata.tvShow
  if (!tvShow) {
    return createEmptyGetEpisodesData()
  }

  const episodeToVideoMap = new Map<string, string>()
  if (metadata.mediaFiles && Array.isArray(metadata.mediaFiles)) {
    for (const mediaFile of metadata.mediaFiles) {
      if (
        mediaFile.seasonNumber !== undefined &&
        mediaFile.episodeNumber !== undefined
      ) {
        const key = `${mediaFile.seasonNumber}:${mediaFile.episodeNumber}`
        episodeToVideoMap.set(key, mediaFile.absolutePath)
      }
    }
  }

  const episodes: GetEpisodesEpisode[] = []

  for (const season of tvShow.seasons ?? []) {
    if (season.episodes && Array.isArray(season.episodes)) {
      for (const ep of season.episodes) {
        const key = `${season.season}:${ep.episode}`
        const videoFilePath = episodeToVideoMap.get(key)
        episodes.push({
          season: season.season,
          episode: ep.episode,
          videoFilePath: videoFilePath
            ? Path.toPlatformPath(videoFilePath)
            : undefined,
        })
      }
    }
  }

  return {
    episodes,
    totalCount: episodes.length,
    showName: tvShow.name ?? '',
    numberOfSeasons: tvShow.seasons?.length ?? 0,
  }
}
