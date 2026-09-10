import { useCallback } from "react"
import type { MediaMetadata } from "@smm/types"
import { askForFormatConverter } from "@/lib/dialogRequestEvents"

/** An episode table row that can be format-converted (season/episode identity). */
export interface TvShowEpisodeFormatConvertRow {
  season: number
  episode: number
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
 * Business logic for the episode row "Format Conversion" context-menu action:
 * resolves the episode's video file from media metadata and asks the top-level
 * `FormatConverter` component (via the {@link askForFormatConverter} document
 * event) to convert it. Kept in a hook so TvShowPanel stays thin.
 */
export function useTvShowEpisodeFormatConvert(mediaMetadata: MediaMetadata | undefined) {
  const handleFormatConvertForRow = useCallback(
    (row: TvShowEpisodeFormatConvertRow) => {
      const videoPath = findEpisodeVideoPath(mediaMetadata, row.season, row.episode)
      if (!videoPath) {
        console.warn(
          `[useTvShowEpisodeFormatConvert] no video file found for S${row.season}E${row.episode}`,
        )
        return
      }
      askForFormatConverter({ filePath: videoPath })
    },
    [mediaMetadata],
  )

  return { handleFormatConvertForRow }
}
