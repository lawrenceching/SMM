import { TMDBMovieOverview } from "./tmdb-movie-overview"
import { useMediaMetadata } from "./media-metadata-provider"
import { FloatingPrompt } from "./FloatingPrompt"
import { useState, useEffect, useCallback, useMemo } from "react"
import type { FileProps } from "@/lib/types"
import { findAssociatedFiles } from "@/lib/utils"
import { newFileName } from "@/api/newFileName"
import { renameFile } from "@/api/renameFile"
import { extname, join } from "@/lib/path"
import { useLatest } from "react-use"
import { toast } from "sonner"
import { findMediaFilesForMovieMediaMetadata } from "@/lib/MovieMediaMetadataUtils"
import type { MediaMetadata } from "@core/types"

function mapTagToFileType(tag: "VID" | "SUB" | "AUD" | "NFO" | "POSTER" | ""): "file" | "video" | "subtitle" | "audio" | "nfo" | "poster" {
    switch(tag) {
        case "VID":
            return "video"
        case "SUB":
            return "subtitle"
        case "AUD":
            return "audio"
        case "NFO":
            return "nfo"
        case "POSTER":
            return "poster"
        default:
            return "file"
    }
}

function newPath(mediaFolderPath: string, videoFilePath: string, associatedFilePath: string): string {
    const videoFileExtension = extname(videoFilePath)
    const associatedFileExtension = extname(associatedFilePath)
    const videoRelativePath = videoFilePath.replace(mediaFolderPath + '/', '')
    const associatedRelativePath = videoRelativePath.replace(videoFileExtension, associatedFileExtension)
    return join(mediaFolderPath, associatedRelativePath)
}

export interface MovieFileModel {
    files: FileProps[]
}

interface ToolbarOption {
  value: "plex" | "emby",
  label: string,
}

function MoviePanel() {
  const { selectedMediaMetadata: rawMediaMetadata, refreshMediaMetadata } = useMediaMetadata()
  const [isToolbarOpen, setIsToolbarOpen] = useState(false)
  const toolbarOptions: ToolbarOption[] = [
    { value: "plex", label: "Plex" } as ToolbarOption,
    { value: "emby", label: "Emby" } as ToolbarOption,
  ]
  const [selectedNamingRule, setSelectedNamingRule] = useState<"plex" | "emby">(toolbarOptions[0]?.value || "plex")
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [previewFileModifications, setPreviewFileModifications] = useState<Map<string, { newPath?: string }>>(new Map())

  /**
   * The rawMediaMetadata comes from backend
   * The mediaMetadata is the processed media metadata by frontend.
   * Frontend will adjust or alter the media metadata for its own requirement.
   * And those change should not persist to backend.
   */
  const mediaMetadata: MediaMetadata | undefined = useMemo(() => {
    if(!rawMediaMetadata) {
      return undefined
    }

    const clone: MediaMetadata = structuredClone(rawMediaMetadata)
    return findMediaFilesForMovieMediaMetadata(clone)
  }, [rawMediaMetadata])

  // Merge base files with preview modifications
  const movieFiles = useMemo<MovieFileModel>(() => {
    if(!mediaMetadata) {
      return { files: [] }
    }

    const model: MovieFileModel = {
      files: []
    }

    for(const file of mediaMetadata.mediaFiles || []) {
      model.files.push({
        type: "video",
        path: file.absolutePath,
      })
    }

    return model    
  }, [mediaMetadata])

  const latestMovieFiles = useLatest(movieFiles)

  // Generate new file names for preview mode
  const generateNewFileNames = useCallback(() => {
    if(!isPreviewMode || !selectedNamingRule) {
      return
    }

    if(mediaMetadata === undefined || mediaMetadata.mediaFolderPath === undefined) {
      return
    }

    const movie = mediaMetadata.tmdbMovie
    if(!movie) {
      return
    }

    (async () => {
      const videoFile = movieFiles.files.find(file => file.type === "video")
      
      if(videoFile === undefined) {
        console.error(`Video file is undefined for movie`)
        return
      }

      const response = await newFileName({
        ruleName: selectedNamingRule,
        type: "movie",
        seasonNumber: 0,
        episodeNumber: 0,
        episodeName: "",
        tvshowName: movie.title || "",
        file: videoFile.path,
        tmdbId: movie.id?.toString() || "",
        releaseYear: movie.release_date ? new Date(movie.release_date).getFullYear().toString() : "",
      })
      
      const modifications = new Map<string, { newPath?: string }>()
      
      if (response.data) {
        const relativePath = response.data
        const absolutePath = join(mediaMetadata.mediaFolderPath!, relativePath)
        modifications.set(videoFile.path, { newPath: absolutePath })

        // Generate new paths for all associated files (subtitles, audio, nfo, poster, etc.)
        for(const file of movieFiles.files) {
          if(file.type === "video") {
            continue
          }
          // Only set newPath for associated files if video file has a newPath
          const associatedNewPath = newPath(mediaMetadata.mediaFolderPath!, absolutePath, file.path)
          modifications.set(file.path, { newPath: associatedNewPath })
        }
      } else {
        // If video file rename failed, clear newPath for associated files
        // Don't add modifications, which means they'll use base files without newPath
      }
      
      setPreviewFileModifications(modifications)
    })()
  }, [mediaMetadata, selectedNamingRule, isPreviewMode, movieFiles])

  // Trigger file name generation when preview mode is enabled
  useEffect(() => {
    if(!isPreviewMode) {
      setPreviewFileModifications(new Map())
      return
    }
    generateNewFileNames()
  }, [isPreviewMode, selectedNamingRule, generateNewFileNames])

  // Handle confirm button click - rename all files
  const handleConfirm = useCallback(async () => {
    if (!mediaMetadata?.mediaFolderPath) {
      toast.error("No media folder path available")
      return
    }

    if (!isPreviewMode) {
      setIsToolbarOpen(false)
      return
    }

    // Collect all files that need to be renamed, separating video files from associated files
    const videoFilesToRename: Array<{ from: string; to: string; type: string }> = []
    const associatedFilesToRename: Array<{ from: string; to: string; type: string }> = []
    
    for (const file of latestMovieFiles.current.files) {
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

    setIsRenaming(true)

    try {
      // Rename files sequentially: video files first, then associated files
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
        setIsToolbarOpen(false)
        setIsPreviewMode(false)
        setIsRenaming(false)
        return
      }
      
      // First, rename all video files
      console.log(`Starting rename: ${filteredVideoFiles.length} video file(s) and ${filteredAssociatedFiles.length} associated file(s)${skippedCount > 0 ? ` (${skippedCount} skipped - identical paths)` : ''}`)
      
      for (const { from, to, type } of filteredVideoFiles) {
        try {
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
        await refreshMediaMetadata(mediaMetadata.mediaFolderPath)
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

      // Close toolbar and exit preview mode
      setIsToolbarOpen(false)
      setIsPreviewMode(false)
      setPreviewFileModifications(new Map())
    } catch (error) {
      console.error("Unexpected error during rename operation:", error)
      toast.error("An unexpected error occurred during rename operation")
    } finally {
      setIsRenaming(false)
    }
  }, [mediaMetadata, isPreviewMode, latestMovieFiles, refreshMediaMetadata])

  return (
    <div className='p-1 w-full h-full relative'>
      <FloatingPrompt 
        isOpen={isToolbarOpen}
        mode="manual"
        options={toolbarOptions}
        selectedValue={selectedNamingRule}
        onValueChange={(value) => {setSelectedNamingRule(value as "plex" | "emby")}}
        onConfirm={handleConfirm}
        onCancel={() => {
          setIsToolbarOpen(false)
          setIsPreviewMode(false)
          setPreviewFileModifications(new Map())
        }}
        confirmLabel={isRenaming ? "Renaming..." : "Confirm"}
        isConfirmDisabled={isRenaming}
      />
      <div className="w-full h-full">
        <TMDBMovieOverview 
          movie={mediaMetadata?.tmdbMovie} 
          className="w-full h-full"
          onRenameClick={() => setIsToolbarOpen(true)}
          ruleName={selectedNamingRule}
          movieFiles={movieFiles}
          isPreviewMode={isPreviewMode}
          setIsPreviewMode={setIsPreviewMode}
        />
      </div>
    </div>
  )
}

export default MoviePanel
