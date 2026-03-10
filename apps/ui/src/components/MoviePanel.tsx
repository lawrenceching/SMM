import { useMediaMetadataStoreState } from "@/stores/mediaMetadataStore"
import { useState, useEffect, useCallback, useMemo } from "react"
import type { FileProps } from "@/lib/types"
import { newFileName } from "@/api/newFileName"
import { join } from "@/lib/path"
import { useLatest } from "react-use"
import { useDialogs } from "@/providers/dialog-provider"
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions"
import { nextTraceId } from "@/lib/utils"
import { renameFiles } from "@/api/renameFiles"
import { toast } from "sonner"
import { useTranslation } from "@/lib/i18n"

import { findMediaFilesForMovieMediaMetadata } from "@/lib/MovieMediaMetadataUtils"
import type { MediaMetadata } from "@core/types"
import type { TMDBMovie } from "@core/types"
import { MovieHeaderV2 } from "./MovieHeaderV2"
import { MovieEpisodeTable, type MovieFileRow } from "./MovieEpisodeTable"
import { RuleBasedRenameFilePrompt } from "./RuleBasedRenameFilePrompt"

export interface MovieFileModel {
    files: FileProps[]
}

interface ToolbarOption {
  value: "plex" | "emby",
  label: string,
}

function MoviePanel() {
  const { t } = useTranslation(['components', 'errors'])
  const { selectedMediaMetadata: rawMediaMetadata } = useMediaMetadataStoreState()
  const { updateMediaMetadata, refreshMediaMetadata } = useMediaMetadataActions()
  const { scrapeDialog } = useDialogs()
  const [openScrape] = scrapeDialog

  const toolbarOptions: ToolbarOption[] = [
    { value: "plex", label: "Plex" } as ToolbarOption,
    { value: "emby", label: "Emby" } as ToolbarOption,
  ]
  const [selectedNamingRule, setSelectedNamingRule] = useState<"plex" | "emby">(toolbarOptions[0]?.value || "plex")
  const [isRenaming, setIsRenaming] = useState(false)

  // Prompt states
  const [isRuleBasedRenameFilePromptOpen, setIsRuleBasedRenameFilePromptOpen] = useState(false)

  /**
   * @deprecated this logic move to MovieUIMediaMetadata, see recognizeMovieMediaFiles method
   *
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
        type: file.type || "video",
        path: file.absolutePath,
        newPath: undefined,
      })
    }

    setMovieFiles(model)
  }, [mediaMetadata])


  // Compute preview mode from prompt states
  const isPreviewingForRename = useMemo(() => {
    return isRuleBasedRenameFilePromptOpen
  }, [isRuleBasedRenameFilePromptOpen])

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

      if(videoFile.path === generatedFilePath) {
        console.log(`[MoviePanel] the current file has been named follow the ${selectedNamingRule} rule, don't need to regenerate`)
        return;
      }

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

  useEffect(() => {
    if(isRuleBasedRenameFilePromptOpen) {
      generateNewFileNames()
    }
  }, [isRuleBasedRenameFilePromptOpen, generateNewFileNames])

  // Handle search result selection
  const handleSelectResult = useCallback(async (result: TMDBMovie) => {
    if (mediaMetadata?.tmdbMovie?.id === result.id) {
      return
    }

    if (!mediaMetadata?.mediaFolderPath) {
      console.error("No media metadata path available")
      return
    }

    const traceId = `movie-panel-handleSelectResult-${nextTraceId()}`
    updateMediaMetadata(mediaMetadata.mediaFolderPath, {
      ...mediaMetadata,
      status: 'updating',
    }, { traceId })

    try {
      // For movies, we just update with the search result
      updateMediaMetadata(mediaMetadata.mediaFolderPath, {
        ...mediaMetadata,
        tmdbMovie: result,
        tmdbMediaType: 'movie',
        type: 'movie-folder',
        status: 'ok',
      }, { traceId })
    } catch (error) {
      console.error("Failed to update media metadata:", error)
      updateMediaMetadata(mediaMetadata.mediaFolderPath, {
        ...mediaMetadata,
        status: 'ok',
      }, { traceId })
    }
  }, [mediaMetadata, updateMediaMetadata])

  // Handle confirm button click - rename all files
  const handleRuleBasedRenameConfirm = useCallback(async () => {
    if (!mediaMetadata?.mediaFolderPath) {
      toast.error("No media folder path available")
      return
    }

    // Collect all files that need to be renamed
    const filesToRename: Array<{ from: string; to: string }> = []

    for (const file of latestMovieFiles.current.files) {
      if (file.newPath && file.path !== file.newPath) {
        filesToRename.push({
          from: file.path,
          to: file.newPath,
        })
      }
    }

    if (filesToRename.length === 0) {
      toast.info("No files to rename")
      setIsRuleBasedRenameFilePromptOpen(false)
      return
    }

    setIsRenaming(true)

    try {
      await renameFiles({ files: filesToRename })
      await refreshMediaMetadata(mediaMetadata.mediaFolderPath)
      toast.success(`Successfully renamed ${filesToRename.length} file${filesToRename.length !== 1 ? 's' : ''}`)
    } catch (error) {
      console.error("Rename failed:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      toast.error(`Failed to rename files: ${errorMessage}`)
    } finally {
      setIsRenaming(false)
      setIsRuleBasedRenameFilePromptOpen(false)
    }
  }, [mediaMetadata, latestMovieFiles, refreshMediaMetadata])

  // Build table data from movieFiles
  const tableData = useMemo<MovieFileRow[]>(() => {
    const rows: MovieFileRow[] = []

    for (const file of movieFiles.files) {
      rows.push({
        id: file.path,
        type: file.type,
        file: file.path,
        newFile: file.newPath,
      })
    }

    return rows
  }, [movieFiles.files])

  return (
    <div className='w-full h-full min-h-0 relative flex flex-col'>
      <div className="shrink-0 px-4 pt-4">
        <MovieHeaderV2
          onSearchResultSelected={handleSelectResult}
          onRenameClick={() => setIsRuleBasedRenameFilePromptOpen(true)}
          selectedMediaMetadata={mediaMetadata}
          openScrape={openScrape}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <MovieEpisodeTable
          key={mediaMetadata?.mediaFolderPath ?? "no-folder"}
          data={tableData}
          mediaFolderPath={mediaMetadata?.mediaFolderPath}
          preview={isPreviewingForRename}
        />
      </div>

      {/* Rename confirmation prompt */}
      <RuleBasedRenameFilePrompt
        isOpen={isRuleBasedRenameFilePromptOpen}
        namingRuleOptions={toolbarOptions}
        selectedNamingRule={selectedNamingRule}
        onNamingRuleChange={(value) => setSelectedNamingRule(value as "plex" | "emby")}
        onConfirm={handleRuleBasedRenameConfirm}
        onCancel={() => setIsRuleBasedRenameFilePromptOpen(false)}
      />
    </div>
  )
}

export default MoviePanel
