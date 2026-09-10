import { useCallback } from "react"
import type { MediaMetadata } from "@smm/types"
import {
  UI_AskForVideoCompression,
  type OnAskForVideoCompressionEventData,
} from "@/types/eventTypes"

/** An episode table row that can be compressed (season/episode identity). */
export interface TvShowEpisodeVideoCompressRow {
  season: number
  episode: number
  episodeTitle?: string
}

/** Resolves the linked video file for a season/episode from media metadata. */
function findEpisodeVideoPath(
  mediaMetadata: MediaMetadata | undefined,
  season: number,
  episode: number,
): string | undefined {
  return mediaMetadata?.mediaFiles?.find(
    (f) => f.seasonNumber === season && f.episodeNumber === episode,
  )?.absolutePath
}

/**
 * Business logic for the episode row "Video Compression" context-menu action.
 *
 * Resolves the episode's video file from media metadata and asks the top-level
 * `VideoCompression` component to compress it by dispatching a
 * {@link UI_AskForVideoCompression} document event. Keeping this logic in a
 * hook (rather than inline in TvShowPanel) keeps the UI component thin and the
 * action testable in isolation.
 */
export function useTvShowEpisodeVideoCompress(mediaMetadata: MediaMetadata | undefined) {
  const handleVideoCompressForRow = useCallback(
    (row: TvShowEpisodeVideoCompressRow) => {
      const videoPath = findEpisodeVideoPath(mediaMetadata, row.season, row.episode)
      if (!videoPath) {
        console.warn(
          `[useTvShowEpisodeVideoCompress] no video file found for S${row.season}E${row.episode}`,
        )
        return
      }
      document.dispatchEvent(
        new CustomEvent<OnAskForVideoCompressionEventData>(UI_AskForVideoCompression, {
          detail: {
            filePath: videoPath,
            title: row.episodeTitle ?? `S${row.season}E${row.episode}`,
          },
        }),
      )
    },
    [mediaMetadata],
  )

  return { handleVideoCompressForRow }
}
