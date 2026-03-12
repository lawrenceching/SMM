import { useCallback } from "react"
import { useLatest } from "react-use"
import { toast } from "sonner"
import type { MediaMetadata } from "@core/types"
import type { SeasonModel } from "../TvShowPanel"
import { Path } from "@core/path"
import { renameFiles } from "@/api/renameFiles"

interface UseTvShowRenamingParams {
  seasons: SeasonModel[]
  mediaMetadata: MediaMetadata | undefined
  refreshMediaMetadata: (mediaFolderPath: string) => void
  setIsRenaming: (renaming: boolean) => void
}

/**
 * Execute a batch of file renames via the unified /api/renameFiles endpoint.
 * Passing `mediaFolder` causes the backend to update media metadata and broadcast
 * the change in the same request, so no separate metadata API call is needed.
 */
async function renameBatch(
  files: Array<{ from: string; to: string }>,
  mediaFolderPath: string,
): Promise<{ successCount: number; errorCount: number; errors: string[] }> {
  const result = await renameFiles({
    files: files.map(({ from, to }) => ({
      from: Path.toPlatformPath(from),
      to: Path.toPlatformPath(to),
    })),
    mediaFolder: Path.posix(mediaFolderPath),
  })

  const successCount = result.data?.succeeded.length ?? 0
  const errorCount = result.data?.failed.length ?? 0
  const errors = (result.data?.failed ?? []).map(
    ({ path, error: err }) => `${Path.toPlatformPath(path)}: ${err}`
  )

  return { successCount, errorCount, errors }
}

export function useTvShowRenaming({
  seasons,
  mediaMetadata,
  refreshMediaMetadata,
  setIsRenaming,
}: UseTvShowRenamingParams) {
  const latestSeasons = useLatest(seasons)

  const startToRenameFiles = useCallback(async (seasonsOverride?: SeasonModel[], selectedEpisodeIds?: Set<string>): Promise<boolean> => {
    console.log("[useTvShowRenaming] startToRenameFiles called, selectedEpisodeIds:", selectedEpisodeIds == null ? "undefined" : `Set(${selectedEpisodeIds.size})`, selectedEpisodeIds ? [...selectedEpisodeIds].sort() : [])
    if (mediaMetadata === undefined || mediaMetadata.mediaFolderPath === undefined) {
      return false
    }

    const seasonsToUse = seasonsOverride ?? latestSeasons.current

    // Collect files that need renaming, keeping video and associated separate
    // so video files are always renamed before their associated files.
    // When selectedEpisodeIds is provided and non-empty, only include episodes whose id (SxxEyy) is in the set.
    const videoFilesToRename: Array<{ from: string; to: string }> = []
    const associatedFilesToRename: Array<{ from: string; to: string }> = []

    const filterBySelection = selectedEpisodeIds != null && selectedEpisodeIds.size > 0
    console.log("[useTvShowRenaming] filterBySelection:", filterBySelection, "seasonsToUse length:", seasonsToUse.length)

    for (const season of seasonsToUse) {
      const seasonNo = season.season.season_number
      for (const episode of season.episodes) {
        const episodeNo = episode.episode.episode_number
        const episodeId = `S${String(seasonNo).padStart(2, "0")}E${String(episodeNo).padStart(2, "0")}`
        if (filterBySelection && !selectedEpisodeIds!.has(episodeId)) continue

        for (const file of episode.files) {
          if (file.newPath && file.path !== file.newPath) {
            if (file.type === "video") {
              videoFilesToRename.push({ from: file.path, to: file.newPath })
            } else {
              associatedFilesToRename.push({ from: file.path, to: file.newPath })
            }
          }
        }
      }
    }

    const filteredVideoFiles = videoFilesToRename.filter(({ from, to }) => from !== to)
    const filteredAssociatedFiles = associatedFilesToRename.filter(({ from, to }) => from !== to)
    const totalFilesToRename = filteredVideoFiles.length + filteredAssociatedFiles.length
    const skippedCount =
      videoFilesToRename.length - filteredVideoFiles.length +
      associatedFilesToRename.length - filteredAssociatedFiles.length

    if (totalFilesToRename === 0) {
      if (skippedCount > 0) {
        toast.info(`No files to rename (${skippedCount} file${skippedCount !== 1 ? 's' : ''} already have correct names)`)
      } else {
        toast.info("No files to rename")
      }
      setIsRenaming(false)
      return false
    }

    console.log(
      `Starting rename: ${filteredVideoFiles.length} video file(s) and ${filteredAssociatedFiles.length} associated file(s)` +
      (skippedCount > 0 ? ` (${skippedCount} skipped - identical paths)` : '')
    )

    let totalSuccess = 0
    let totalErrors = 0
    const allErrors: string[] = []

    // Rename video files first (metadata update happens server-side via mediaFolder param)
    if (filteredVideoFiles.length > 0) {
      try {
        const { successCount, errorCount, errors } = await renameBatch(
          filteredVideoFiles,
          mediaMetadata.mediaFolderPath,
        )
        totalSuccess += successCount
        totalErrors += errorCount
        allErrors.push(...errors)
        filteredVideoFiles.slice(0, successCount).forEach(({ from }) =>
          console.log(`✓ Renamed video file: ${Path.toPlatformPath(from)}`)
        )
        errors.forEach(e => console.error(`✗ ${e}`))
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error"
        totalErrors += filteredVideoFiles.length
        filteredVideoFiles.forEach(({ from }) => {
          allErrors.push(`video file ${Path.toPlatformPath(from)}: ${msg}`)
          console.error(`✗ Failed to rename video file ${Path.toPlatformPath(from)}:`, error)
        })
      }
    }

    // Then rename associated files (subtitle, audio, nfo, poster, etc.)
    if (filteredAssociatedFiles.length > 0) {
      try {
        const { successCount, errorCount, errors } = await renameBatch(
          filteredAssociatedFiles,
          mediaMetadata.mediaFolderPath,
        )
        totalSuccess += successCount
        totalErrors += errorCount
        allErrors.push(...errors)
        filteredAssociatedFiles.slice(0, successCount).forEach(({ from }) =>
          console.log(`✓ Renamed associated file: ${Path.toPlatformPath(from)}`)
        )
        errors.forEach(e => console.error(`✗ ${e}`))
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error"
        totalErrors += filteredAssociatedFiles.length
        filteredAssociatedFiles.forEach(({ from }) => {
          allErrors.push(`associated file ${Path.toPlatformPath(from)}: ${msg}`)
          console.error(`✗ Failed to rename associated file ${Path.toPlatformPath(from)}:`, error)
        })
      }
    }

    // Backend already updated metadata via the mediaFolder param; just refresh UI state
    if (totalSuccess > 0) {
      refreshMediaMetadata(mediaMetadata.mediaFolderPath)
    }

    const skippedMessage = skippedCount > 0 ? ` (${skippedCount} skipped)` : ''
    if (totalErrors === 0) {
      toast.success(
        `Successfully renamed ${totalSuccess} file${totalSuccess !== 1 ? 's' : ''} ` +
        `(${filteredVideoFiles.length} video, ${filteredAssociatedFiles.length} associated)${skippedMessage}`
      )
      return true
    }
    if (totalSuccess > 0) {
      toast.warning(`Renamed ${totalSuccess} file${totalSuccess !== 1 ? 's' : ''}, ${totalErrors} failed${skippedMessage}`)
      console.error("Rename errors:", allErrors)
    } else {
      toast.error(`Failed to rename ${totalErrors} file${totalErrors !== 1 ? 's' : ''}${skippedMessage}`)
      console.error("All rename operations failed:", allErrors)
    }
    return false
  }, [mediaMetadata, latestSeasons, refreshMediaMetadata, setIsRenaming])

  return {
    startToRenameFiles,
  }
}
