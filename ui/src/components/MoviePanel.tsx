import { TMDBMovieOverview } from "./tmdb-movie-overview"
import { useMediaMetadata } from "./media-metadata-provider"
import { RuleBasedRenameFilePrompt } from "./RuleBasedRenameFilePrompt"
import { AiBasedRenameFilePrompt } from "./AiBasedRenameFilePrompt"
import { AiBasedRecognizePrompt } from "./AiBasedRecognizePrompt"
import { RuleBasedRecognizePrompt } from "./RuleBasedRecognizePrompt"
import { useState, useEffect, useCallback, useMemo } from "react"
import type { FileProps } from "@/lib/types"
import { newFileName } from "@/api/newFileName"
import { renameFile } from "@/api/renameFile"
import { extname, join } from "@/lib/path"
import { useLatest } from "react-use"
import { toast } from "sonner"
import { findMediaFilesForMovieMediaMetadata } from "@/lib/MovieMediaMetadataUtils"
import type { MediaMetadata } from "@core/types"

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
  const toolbarOptions: ToolbarOption[] = [
    { value: "plex", label: "Plex" } as ToolbarOption,
    { value: "emby", label: "Emby" } as ToolbarOption,
  ]
  const [selectedNamingRule, setSelectedNamingRule] = useState<"plex" | "emby">(toolbarOptions[0]?.value || "plex")
  const [isRenaming, setIsRenaming] = useState(false)

  // Prompt states
  const [isRuleBasedRenameFilePromptOpen, setIsRuleBasedRenameFilePromptOpen] = useState(false)
  const [isAiBasedRenameFilePromptOpen, setIsAiBasedRenameFilePromptOpen] = useState(false)
  const [aiBasedRenameFileStatus] = useState<"generating" | "wait-for-ack">("generating")
  const [isAiRecognizePromptOpen, setIsAiRecognizePromptOpen] = useState(false)
  const [aiRecognizeStatus] = useState<"generating" | "wait-for-ack">("generating")
  const [isRuleBasedRecognizePromptOpen, setIsRuleBasedRecognizePromptOpen] = useState(false)

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


  const [movieFiles, setMovieFiles] = useState<MovieFileModel>({ files: [] })
  const latestMovieFiles = useLatest(movieFiles)
  // Merge base files with preview modifications
  useEffect(() => {
    if(!mediaMetadata) {
      return;
    }

    const model: MovieFileModel = {
      files: []
    }

    for(const file of mediaMetadata.mediaFiles || []) {
      model.files.push({
        type: "video",
        path: file.absolutePath,
        newPath: undefined,
      })
    }

    setMovieFiles(model)
  }, [mediaMetadata])


  // Compute preview mode from prompt states
  const isPreviewMode = useMemo(() => {
    return isAiBasedRenameFilePromptOpen || isRuleBasedRenameFilePromptOpen || isRuleBasedRecognizePromptOpen
  }, [isAiBasedRenameFilePromptOpen, isRuleBasedRenameFilePromptOpen, isRuleBasedRecognizePromptOpen])

  // Generate new file names for preview mode
  const generateNewFileNames = useCallback(() => {

    console.log(`[MoviePanel] generateNewFileNames() started`, {
      isRuleBasedRenameFilePromptOpen,
      selectedNamingRule,
      movieFiles,
    })

    if(!isRuleBasedRenameFilePromptOpen) {
      return
    }

    if(!selectedNamingRule) {
      console.log(`[MoviePanel] generateNewFileNames() selectedNamingRule is undefined, skip generation`)
      return;
    }

    if(mediaMetadata === undefined || mediaMetadata.mediaFolderPath === undefined) {
      console.error(`[MoviePanel] generateNewFileNames() mediaMetadata is undefined or mediaFolderPath is undefined, skip generation`)
      return
    }

    const movie = mediaMetadata.tmdbMovie
    if(!movie) {
      console.error(`[MoviePanel] generateNewFileNames() movie is undefined, skip generation`)
      return
    }

    (async () => {
      const videoFile = latestMovieFiles.current.files.find(file => file.type === "video")
      
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
        movieName: movie.title || "",
      })
      
      const generatedFileRelativePath = response.data;
      const generatedFilePath = join(mediaMetadata.mediaFolderPath!, generatedFileRelativePath);

      setMovieFiles(prev => {
        return {
          ...prev,
          files: prev.files.map(file => {
            if(file.type === "video") {
              return { ...file, newPath: generatedFilePath }
            }
            return file
          })
        }
      })

    })()
  }, [isRuleBasedRenameFilePromptOpen, mediaMetadata, selectedNamingRule])

  // Trigger file name generation when rule-based rename prompt is opened
  // useEffect(() => {
  //   if(!isRuleBasedRenameFilePromptOpen) {
  //     setPreviewFileModifications(new Map())
  //     return
  //   }
  //   generateNewFileNames()
  // }, [isRuleBasedRenameFilePromptOpen, selectedNamingRule, generateNewFileNames])

  // Handle confirm button click - rename all files
  // const handleRuleBasedRenameConfirm = useCallback(async () => {
  //   if (!mediaMetadata?.mediaFolderPath) {
  //     toast.error("No media folder path available")
  //     return
  //   }

  //   if (!isRuleBasedRenameFilePromptOpen) {
  //     // setIsRuleBasedRenameFilePromptOpen(false)
  //     return
  //   }

  //   // Collect all files that need to be renamed, separating video files from associated files
  //   const videoFilesToRename: Array<{ from: string; to: string; type: string }> = []
  //   const associatedFilesToRename: Array<{ from: string; to: string; type: string }> = []
    
  //   for (const file of latestMovieFiles.current.files) {
  //     if (file.newPath && file.path !== file.newPath) {
  //       const renameEntry = {
  //         from: file.path,
  //         to: file.newPath,
  //         type: file.type
  //       }
        
  //       // Separate video files from associated files
  //       if (file.type === "video") {
  //         videoFilesToRename.push(renameEntry)
  //       } else {
  //         associatedFilesToRename.push(renameEntry)
  //       }
  //     }
  //   }

  //   setIsRenaming(true)

  //   try {
  //     // Rename files sequentially: video files first, then associated files
  //     let successCount = 0
  //     let errorCount = 0
  //     const errors: string[] = []

  //     // Filter out files where from and to are identical before sending requests
  //     const filteredVideoFiles = videoFilesToRename.filter(({ from, to }) => from !== to)
  //     const filteredAssociatedFiles = associatedFilesToRename.filter(({ from, to }) => from !== to)
      
  //     const totalFilesToRename = filteredVideoFiles.length + filteredAssociatedFiles.length
  //     const skippedCount = (videoFilesToRename.length - filteredVideoFiles.length) + 
  //                         (associatedFilesToRename.length - filteredAssociatedFiles.length)

  //     if (totalFilesToRename === 0) {
  //       if (skippedCount > 0) {
  //         toast.info(`No files to rename (${skippedCount} file${skippedCount !== 1 ? 's' : ''} already have correct names)`)
  //       } else {
  //         toast.info("No files to rename")
  //       }
  //       // setIsRuleBasedRenameFilePromptOpen(false)
  //       setIsRenaming(false)
  //       return
  //     }
      
  //     // First, rename all video files
  //     console.log(`Starting rename: ${filteredVideoFiles.length} video file(s) and ${filteredAssociatedFiles.length} associated file(s)${skippedCount > 0 ? ` (${skippedCount} skipped - identical paths)` : ''}`)
      
  //     for (const { from, to, type } of filteredVideoFiles) {
  //       try {
  //         await renameFile({
  //           mediaFolder: mediaMetadata.mediaFolderPath,
  //           from,
  //           to,
  //         })
  //         successCount++
  //         console.log(`✓ Renamed video file: ${from} -> ${to}`)
  //       } catch (error) {
  //         errorCount++
  //         const errorMessage = error instanceof Error ? error.message : "Unknown error"
  //         errors.push(`${type} file ${from}: ${errorMessage}`)
  //         console.error(`✗ Failed to rename video file ${from} to ${to}:`, error)
  //       }
  //     }

  //     // Then, rename all associated files (subtitles, audio, nfo, poster, etc.)
  //     for (const { from, to, type } of filteredAssociatedFiles) {
  //       try {
  //         await renameFile({
  //           mediaFolder: mediaMetadata.mediaFolderPath,
  //           from,
  //           to,
  //         })
  //         successCount++
  //         console.log(`✓ Renamed ${type} file: ${from} -> ${to}`)
  //       } catch (error) {
  //         errorCount++
  //         const errorMessage = error instanceof Error ? error.message : "Unknown error"
  //         errors.push(`${type} file ${from}: ${errorMessage}`)
  //         console.error(`✗ Failed to rename ${type} file ${from} to ${to}:`, error)
  //       }
  //     }

  //     // Refresh media metadata after all renames
  //     if (successCount > 0) {
  //       await refreshMediaMetadata(mediaMetadata.mediaFolderPath)
  //     }

  //     // Show results
  //     const skippedMessage = skippedCount > 0 ? ` (${skippedCount} skipped)` : ''
  //     if (errorCount === 0) {
  //       toast.success(`Successfully renamed ${successCount} file${successCount !== 1 ? 's' : ''} (${filteredVideoFiles.length} video, ${filteredAssociatedFiles.length} associated)${skippedMessage}`)
  //     } else if (successCount > 0) {
  //       toast.warning(`Renamed ${successCount} file${successCount !== 1 ? 's' : ''}, ${errorCount} failed${skippedMessage}`)
  //       console.error("Rename errors:", errors)
  //     } else {
  //       toast.error(`Failed to rename ${errorCount} file${errorCount !== 1 ? 's' : ''}${skippedMessage}`)
  //       console.error("All rename operations failed:", errors)
  //     }

  //     // Close prompt and exit preview mode
  //     // setIsRuleBasedRenameFilePromptOpen(false)
  //     setPreviewFileModifications(new Map())
  //   } catch (error) {
  //     console.error("Unexpected error during rename operation:", error)
  //     toast.error("An unexpected error occurred during rename operation")
  //   } finally {
  //     setIsRenaming(false)
  //   }
  // }, [mediaMetadata, isRuleBasedRenameFilePromptOpen, latestMovieFiles, refreshMediaMetadata])

  // Handle AI-based rename confirm
  // const handleAiBasedRenameConfirm = useCallback(async () => {
  //   if (!mediaMetadata?.mediaFolderPath) {
  //     toast.error("No media folder path available")
  //     return
  //   }

  //   // Similar logic to handleRuleBasedRenameConfirm but for AI-based renaming
  //   // This can be implemented when AI-based renaming is needed for movies
  //   setIsAiBasedRenameFilePromptOpen(false)
  // }, [mediaMetadata])

  useEffect(() => {

    if(isRuleBasedRenameFilePromptOpen) {
      generateNewFileNames()
    }

  }, [isRuleBasedRenameFilePromptOpen, generateNewFileNames])

  return (
    <div className='p-1 w-full h-full relative'>
      <div className="absolute top-0 left-0 w-full z-20">
        <RuleBasedRenameFilePrompt
          isOpen={isRuleBasedRenameFilePromptOpen}
          namingRuleOptions={toolbarOptions}
          selectedNamingRule={selectedNamingRule}
          onNamingRuleChange={(value) => {
            setSelectedNamingRule(value as "plex" | "emby")
          }}
          // onConfirm={handleRuleBasedRenameConfirm}
          onCancel={() => {
            setIsRuleBasedRenameFilePromptOpen(false)
          }}
        />

        <AiBasedRenameFilePrompt
          isOpen={isAiBasedRenameFilePromptOpen}
          status={aiBasedRenameFileStatus}
          // onConfirm={handleAiBasedRenameConfirm}
          onCancel={() => setIsAiBasedRenameFilePromptOpen(false)}
        />

        <AiBasedRecognizePrompt
          isOpen={isAiRecognizePromptOpen}
          status={aiRecognizeStatus}
          onConfirm={() => {
            setIsAiRecognizePromptOpen(false)
          }}
          onCancel={() => {
            setIsAiRecognizePromptOpen(false)
          }}
          isConfirmDisabled={isRenaming}
        />

        <RuleBasedRecognizePrompt
          isOpen={isRuleBasedRecognizePromptOpen}
          onConfirm={() => {
            setIsRuleBasedRecognizePromptOpen(false)
          }}
          onCancel={() => {
            setIsRuleBasedRecognizePromptOpen(false)
          }}
        />
      </div>

      <div className="w-full h-full">
        <TMDBMovieOverview 
          movie={mediaMetadata?.tmdbMovie} 
          className="w-full h-full"
          onRenameClick={() => {
            setIsRuleBasedRenameFilePromptOpen(true)
          }}
          ruleName={selectedNamingRule}
          movieFiles={movieFiles}
          isPreviewMode={isPreviewMode}
        />
      </div>
    </div>
  )
}

export default MoviePanel
