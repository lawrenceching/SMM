import type { MediaMetadata } from "@core/types"
import { generateNewFileName } from "@/lib/renameRules"
import { join } from "@/lib/path"
import { mediaFilePathEqual } from "@/lib/mediaFilePathEqual"

/**
 * Build rename plan entries for a TV show using the selected naming rule.
 * Omits episodes whose generated path equals the current video path.
 */
export function buildTvShowRenamePlanFileEntries(
  mediaMetadata: MediaMetadata,
  selectedNamingRule: "plex" | "emby",
): Array<{ from: string; to: string }> {
  const files: Array<{ from: string; to: string }> = []
  const tvShow = mediaMetadata.tvShow
  const mediaFolderPath = mediaMetadata.mediaFolderPath

  if (!tvShow || !mediaFolderPath) {
    return files
  }

  for (const season of tvShow.seasons) {
    if (!season.episodes) continue

    for (const episode of season.episodes) {
      const mediaFile = mediaMetadata.mediaFiles?.find(
        (file) =>
          file.seasonNumber === season.season && file.episodeNumber === episode.episode,
      )

      if (!mediaFile) continue

      const relativePath = generateNewFileName(selectedNamingRule, {
        type: "tv",
        seasonNumber: season.season,
        episodeNumber: episode.episode,
        episodeName: episode.name || "",
        tvshowName: tvShow.name || "",
        file: mediaFile.absolutePath,
        tmdbId: tvShow.id?.toString() || "",
        releaseYear: tvShow.airDate ?? "",
      })

      const absolutePath = join(mediaFolderPath, relativePath)

      if (mediaFilePathEqual(mediaFile.absolutePath, absolutePath)) {
        continue
      }

      files.push({
        from: mediaFile.absolutePath,
        to: absolutePath,
      })
    }
  }

  return files
}
