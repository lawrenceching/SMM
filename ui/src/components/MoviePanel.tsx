import { TMDBMovieOverview } from "./tmdb-movie-overview"
import { useMediaMetadata } from "./media-metadata-provider"
import { FloatingToolbar } from "./FloatingToolbar"
import React, { useState, useEffect, useCallback } from "react"
import type { FileProps } from "@/lib/types"
import { findAssociatedFiles } from "@/lib/utils"
import { newFileName } from "@/api/newFileName"
import { renameFile } from "@/api/renameFile"
import { extname, join } from "@/lib/path"
import { useLatest } from "react-use"
import { toast } from "sonner"

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

function buildFileProps(mediaMetadata: import("@core/types").MediaMetadata): FileProps[] {
    if(mediaMetadata.mediaFolderPath === undefined) {
        console.error(`Media folder path is undefined`)
        return []
    }

    if(mediaMetadata.mediaFiles === undefined || mediaMetadata.mediaFiles.length === 0) {
        return []
    }

    if(mediaMetadata.files === undefined || mediaMetadata.files === null) {
        return []
    }

    // For movies, we typically have a single video file
    const mediaFile = mediaMetadata.mediaFiles[0]
    const videoFilePath = mediaFile.absolutePath

    const files = findAssociatedFiles(mediaMetadata.mediaFolderPath, mediaMetadata.files, videoFilePath)

    const fileProps: FileProps[] = [
        {
            type: "video",
            path: mediaFile.absolutePath,
        },
        ...files.map(file => ({
            type: mapTagToFileType(file.tag),
            path: join(mediaMetadata.mediaFolderPath!, file.path),
        }))
    ]

    return fileProps
}

export interface MovieFileModel {
    files: FileProps[]
}

interface ToolbarOption {
  value: "plex" | "emby",
  label: string,
}

function MoviePanel() {
  const { selectedMediaMetadata: mediaMetadata, refreshMediaMetadata } = useMediaMetadata()
  const [isToolbarOpen, setIsToolbarOpen] = useState(false)
  const toolbarOptions: ToolbarOption[] = [
    { value: "plex", label: "Plex" } as ToolbarOption,
    { value: "emby", label: "Emby" } as ToolbarOption,
  ]
  const [selectedNamingRule, setSelectedNamingRule] = useState<"plex" | "emby">(toolbarOptions[0]?.value || "plex")
  const [movieFiles, setMovieFiles] = useState<MovieFileModel>({ files: [] })
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const latestMovieFiles = useLatest(movieFiles)

  // Build movie files state from media metadata
  const updateMovieFiles = useCallback(() => {
    if(!mediaMetadata) {
      setMovieFiles({ files: [] })
      return
    }

    const files = buildFileProps(mediaMetadata)
    setMovieFiles({ files })
  }, [mediaMetadata])

  // Update files when media metadata changes
  useEffect(() => {
    updateMovieFiles()
  }, [updateMovieFiles])

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
      const newMovieFiles = structuredClone(latestMovieFiles.current)
      const videoFile = newMovieFiles.files.find(file => file.type === "video")
      
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
      
      if (response.data) {
        const relativePath = response.data
        const absolutePath = join(mediaMetadata.mediaFolderPath!, relativePath)
        videoFile.newPath = absolutePath

        // Generate new paths for all associated files (subtitles, audio, nfo, poster, etc.)
        for(const file of newMovieFiles.files) {
          if(file.type === "video") {
            continue
          }
          // Only set newPath for associated files if video file has a newPath
          file.newPath = newPath(mediaMetadata.mediaFolderPath!, absolutePath, file.path)
        }
      } else {
        // If video file rename failed, clear newPath for associated files
        for(const file of newMovieFiles.files) {
          if(file.type !== "video") {
            file.newPath = undefined
          }
        }
      }
      
      setMovieFiles(newMovieFiles)
    })()
  }, [mediaMetadata, selectedNamingRule, isPreviewMode, latestMovieFiles])

  // Trigger file name generation when preview mode is enabled
  useEffect(() => {
    if(!isPreviewMode) {
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
    } catch (error) {
      console.error("Unexpected error during rename operation:", error)
      toast.error("An unexpected error occurred during rename operation")
    } finally {
      setIsRenaming(false)
    }
  }, [mediaMetadata, isPreviewMode, latestMovieFiles, refreshMediaMetadata])

  return (
    <div className='p-1 w-full h-full relative'>
      <FloatingToolbar 
        isOpen={isToolbarOpen}
        options={toolbarOptions}
        selectedValue={selectedNamingRule}
        onValueChange={(value) => {setSelectedNamingRule(value as "plex" | "emby")}}
        onConfirm={handleConfirm}
        onCancel={() => {
          setIsToolbarOpen(false)
          setIsPreviewMode(false)
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
