import { useCallback } from "react"
import { toast } from "sonner"
import type { MediaMetadata } from "@core/types"
import { Path } from "@core/path"
import { basename, extname } from "@/lib/path"
import { renameFiles } from "@/api/renameFiles"
import type { RenameFilesPlan } from "@core/types/RenameFilesPlan"

interface UseTvShowRenamingParams {
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
  mediaMetadata,
  refreshMediaMetadata,
  setIsRenaming,
}: UseTvShowRenamingParams) {
  
  const startToRenameFiles = useCallback(async (renamePlan: RenameFilesPlan): Promise<boolean> => {
    
    if (mediaMetadata === undefined || mediaMetadata.mediaFolderPath === undefined) {
      return false
    }

    if(renamePlan.files.length === 0) {
      console.warn(`skip RenameFilesPlan because no files to rename`)
      return false
    }

    // Collect files that need renaming, keeping video and associated separate
    // so video files are always renamed before their associated files.
    // When selectedEpisodeIds is provided and non-empty, only include episodes whose id (SxxEyy) is in the set.
    const videoFilesToRename: Array<{ from: string; to: string }> = []
    const associatedFilesToRename: Array<{ from: string; to: string }> = []

    if (renamePlan && renamePlan.files) {
      // Use files from the rename plan
      for (const { from, to } of renamePlan.files) {
        // Find the media file for this path to get season/episode info
        const mediaFile = mediaMetadata.mediaFiles?.find(
          file => file.absolutePath === from
        );

        // Add to appropriate rename list
        videoFilesToRename.push({ from, to })

        // Process associated files (subtitles, audio, etc.)
        if (mediaFile) {
          if (mediaFile.subtitleFilePaths) {
            for (const subtitlePath of mediaFile.subtitleFilePaths) {
              // Generate new path for subtitle file
              const newSubtitlePath = generateNewPathForAssociatedFile(from, to, subtitlePath);
              if (subtitlePath !== newSubtitlePath) {
                associatedFilesToRename.push({ from: subtitlePath, to: newSubtitlePath });
              }
            }
          }

          if (mediaFile.audioFilePaths) {
            for (const audioPath of mediaFile.audioFilePaths) {
              // Generate new path for audio file
              const newAudioPath = generateNewPathForAssociatedFile(from, to, audioPath);
              if (audioPath !== newAudioPath) {
                associatedFilesToRename.push({ from: audioPath, to: newAudioPath });
              }
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
  }, [mediaMetadata, refreshMediaMetadata, setIsRenaming])

  return {
    startToRenameFiles,
  }
}

/**
 * Generate new path for associated files (subtitles, audio) based on the new video file path
 */
function generateNewPathForAssociatedFile(videoPath: string, newVideoPath: string, associatedPath: string): string {
  // Get the base name of the video file without extension
  const videoBase = basename(videoPath) ?? '';
  const videoExt = extname(videoPath);
  const videoBaseName = videoExt ? videoBase.slice(0, -videoExt.length) : videoBase;
  const newVideoBase = basename(newVideoPath) ?? '';
  const newVideoExt = extname(newVideoPath);
  const newVideoBaseName = newVideoExt ? newVideoBase.slice(0, -newVideoExt.length) : newVideoBase;
  // Replace the video base name in the associated file path
  return associatedPath.replace(videoBaseName, newVideoBaseName);
}
