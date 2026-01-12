import { useCallback } from "react"
import { useLatest } from "react-use"
import { toast } from "sonner"
import type { MediaMetadata } from "@core/types"
import type { SeasonModel } from "../../TvShowPanel"
import { renameFile } from "@/api/renameFile"

interface UseTvShowRenamingParams {
  seasons: SeasonModel[]
  mediaMetadata: MediaMetadata | undefined
  refreshMediaMetadata: (mediaFolderPath: string) => void
  setIsRenaming: (renaming: boolean) => void
}

export function useTvShowRenaming({
  seasons,
  mediaMetadata,
  refreshMediaMetadata,
  setIsRenaming,
}: UseTvShowRenamingParams) {
  const latestSeasons = useLatest(seasons)

  const startToRenameFiles = useCallback(async () => {
    if(mediaMetadata === undefined || mediaMetadata.mediaFolderPath === undefined) {
      return;
    }

    // Collect all files that need to be renamed, separating video files from associated files
    const videoFilesToRename: Array<{ from: string; to: string; type: string }> = []
    const associatedFilesToRename: Array<{ from: string; to: string; type: string }> = []
    
    for (const season of latestSeasons.current) {
      for (const episode of season.episodes) {
        for (const file of episode.files) {
          if (file.newPath && file.path !== file.newPath) {
            const renameEntry = {
              from: file.path,
              to: file.newPath,
              type: file.type
            }
            
            // Separate video files from associated files
            if (file.type === "video") {
              videoFilesToRename.push(renameEntry)
            } else {
              associatedFilesToRename.push(renameEntry)
            }
          }
        }
      }
    }

    try {
      // Rename files sequentially: video files first, then associated files
      // This ensures video files are renamed before associated files that depend on them
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []

      // Filter out files where from and to are identical before sending requests
      const filteredVideoFiles = videoFilesToRename.filter(({ from, to }) => from !== to)
      const filteredAssociatedFiles = associatedFilesToRename.filter(({ from, to }) => from !== to)
      
      const totalFilesToRename = filteredVideoFiles.length + filteredAssociatedFiles.length
      const skippedCount = (videoFilesToRename.length - filteredVideoFiles.length) + 
                          (associatedFilesToRename.length - filteredAssociatedFiles.length)

      if (totalFilesToRename === 0) {
        if (skippedCount > 0) {
          toast.info(`No files to rename (${skippedCount} file${skippedCount !== 1 ? 's' : ''} already have correct names)`)
        } else {
          toast.info("No files to rename")
        }
        setIsRenaming(false)
        return
      }
      
      // First, rename all video files
      console.log(`Starting rename: ${filteredVideoFiles.length} video file(s) and ${filteredAssociatedFiles.length} associated file(s)${skippedCount > 0 ? ` (${skippedCount} skipped - identical paths)` : ''}`)
      
      for (const { from, to, type } of filteredVideoFiles) {
        try {
          // TODO:
          // the renameFile API in backend will trigger mediaMetadataUpdated event
          // so mulitple readMediaMetadata API calls was triggered 
          // 1. Consider to create renameFileInBatch API
          // 2. Consider not to trigger mediaMetadataUpdated for frontend API call (still need to trigger it for AI Agent rename file)
          await renameFile({
            mediaFolder: mediaMetadata.mediaFolderPath,
            from,
            to,
          })
          successCount++
          console.log(`✓ Renamed video file: ${from} -> ${to}`)
        } catch (error) {
          errorCount++
          const errorMessage = error instanceof Error ? error.message : "Unknown error"
          errors.push(`${type} file ${from}: ${errorMessage}`)
          console.error(`✗ Failed to rename video file ${from} to ${to}:`, error)
        }
      }

      // Then, rename all associated files (subtitles, audio, nfo, poster, etc.)
      for (const { from, to, type } of filteredAssociatedFiles) {
        try {
          await renameFile({
            mediaFolder: mediaMetadata.mediaFolderPath,
            from,
            to,
          })
          successCount++
          console.log(`✓ Renamed ${type} file: ${from} -> ${to}`)
        } catch (error) {
          errorCount++
          const errorMessage = error instanceof Error ? error.message : "Unknown error"
          errors.push(`${type} file ${from}: ${errorMessage}`)
          console.error(`✗ Failed to rename ${type} file ${from} to ${to}:`, error)
        }
      }

      // Refresh media metadata after all renames
      if (successCount > 0) {
        refreshMediaMetadata(mediaMetadata.mediaFolderPath)
      }

      // Show results
      const skippedMessage = skippedCount > 0 ? ` (${skippedCount} skipped)` : ''
      if (errorCount === 0) {
        toast.success(`Successfully renamed ${successCount} file${successCount !== 1 ? 's' : ''} (${filteredVideoFiles.length} video, ${filteredAssociatedFiles.length} associated)${skippedMessage}`)
      } else if (successCount > 0) {
        toast.warning(`Renamed ${successCount} file${successCount !== 1 ? 's' : ''}, ${errorCount} failed${skippedMessage}`)
        console.error("Rename errors:", errors)
      } else {
        toast.error(`Failed to rename ${errorCount} file${errorCount !== 1 ? 's' : ''}${skippedMessage}`)
        console.error("All rename operations failed:", errors)
      }


    } catch (error) {
      console.error("Unexpected error during rename operation:", error)
      toast.error("An unexpected error occurred during rename operation")
    }
  }, [mediaMetadata, latestSeasons, refreshMediaMetadata, setIsRenaming])

  return {
    startToRenameFiles,
  }
}
