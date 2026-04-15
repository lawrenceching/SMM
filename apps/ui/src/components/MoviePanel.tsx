import { useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"
import { useMediaMetadataQuery } from "@/hooks/mediaMetadata"
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import { useState, useEffect, useCallback, useMemo } from "react"
import type { FileProps } from "@/lib/types"
import { newFileName } from "@/api/newFileName"
import { join } from "@/lib/path"
import { useLatest } from "react-use"
import { useDialogs } from "@/providers/dialog-provider"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import { useUpdateMediaMetadataMutation } from "@/hooks/mediaMetadata/useUpdateMediaMetadataMutation"
import { nextTraceId } from "@/lib/utils"
import { renameFiles } from "@/api/renameFiles"
import { toast } from "sonner"
import { findMediaFilesForMovieMediaMetadata } from "@/lib/MovieMediaMetadataUtils"
import type { MediaMetadata } from "@core/types"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import { MovieHeaderV2 } from "./MovieHeaderV2"
import { MovieEpisodeTable, type MovieFileRow } from "./MovieEpisodeTable"
import { RuleBasedRenameFilePrompt } from "./RuleBasedRenameFilePrompt"
import { MediaPanelInitializingHint } from "./MediaPanelInitializingHint"
import type { SearchResultSelectedArgs } from "./MediaDatabaseSearchbox"
import Debug from 'debug'
import { useGetTvdbMovieMutation } from "@/hooks/useGetTvdbMovieMutation"
import { useGetTmdbMovieMutation } from "@/hooks/useGetTmdbMovieMutation"
const debug = Debug('MoviePanel')

export interface MovieFileModel {
    files: FileProps[]
}

interface ToolbarOption {
  value: "plex" | "emby",
  label: string,
}

function MoviePanel() {
  const { folders, selectedFolder } = useUIMediaFolderStoreState()
  const {
    data: queriedMediaMetadata,
    isError: isMediaMetadataError,
    isPending: isMediaMetadataPending,
    fetchStatus: mediaMetadataFetchStatus,
  } = useMediaMetadataQuery(selectedFolder || undefined)

  const uiFolderRow = useMemo(
    () =>
      selectedFolder
        ? folders.find(
            (f) =>
              normalizeMediaFolderPathForQuery(f.path) ===
              normalizeMediaFolderPathForQuery(selectedFolder),
          )
        : undefined,
    [folders, selectedFolder],
  )

  const rawMediaMetadata = useMemo((): UIMediaMetadata | undefined => {
    if (!selectedFolder?.trim()) return undefined

    const domain = queriedMediaMetadata

    const status: UIMediaMetadata["status"] = (() => {
      if (isMediaMetadataError) return "error_loading_metadata"
      if (domain) return "ok"
      if (uiFolderRow?.status) return uiFolderRow.status
      if (isMediaMetadataPending || mediaMetadataFetchStatus === "fetching") return "initializing"
      return "loading"
    })()

    if (!domain) {
      const normalizedPath = normalizeMediaFolderPathForQuery(selectedFolder)
      return {
        mediaFolderPath: normalizedPath,
        type: "movie-folder",
        status,
      } as UIMediaMetadata
    }

    return {
      ...domain,
      status,
    }
  }, [
    selectedFolder,
    queriedMediaMetadata,
    isMediaMetadataError,
    isMediaMetadataPending,
    mediaMetadataFetchStatus,
    uiFolderRow?.status,
  ])

  const { mutateAsync: fetchMediaMetadata } = useFetchMediaMetadataMutation()
  const { mutateAsync: saveMediaMetadata } = useUpdateMediaMetadataMutation()
  const updateMediaMetadata = useCallback(
    async (
      path: string,
      updaterOrMetadata: UIMediaMetadata | ((current: UIMediaMetadata) => UIMediaMetadata),
      options?: { traceId?: string },
    ) => {
      const pathPosix = normalizeMediaFolderPathForQuery(path)
      if (!pathPosix) return
      const current = (await fetchMediaMetadata({ path: pathPosix, traceId: options?.traceId })) as UIMediaMetadata
      const next =
        typeof updaterOrMetadata === "function"
          ? updaterOrMetadata(current)
          : updaterOrMetadata
      await saveMediaMetadata({ pathPosix, metadata: next, traceId: options?.traceId })
    },
    [fetchMediaMetadata, saveMediaMetadata],
  )
  const refreshMediaMetadata = useCallback(
    async (path: string, options?: { traceId?: string }) => {
      await fetchMediaMetadata({ path, traceId: options?.traceId })
    },
    [fetchMediaMetadata],
  )
  const { mutate: getTvdbMovie } = useGetTvdbMovieMutation()
  const { mutate: getTmdbMovie } = useGetTmdbMovieMutation()
  const { scrapeDialog } = useDialogs()
  const [openScrape] = scrapeDialog

  const toolbarOptions: ToolbarOption[] = [
    { value: "plex", label: "Plex" } as ToolbarOption,
    { value: "emby", label: "Emby" } as ToolbarOption,
  ]
  const [selectedNamingRule, setSelectedNamingRule] = useState<"plex" | "emby">(toolbarOptions[0]?.value || "plex")
  const [, setIsRenaming] = useState(false)

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

    // move this step to Media Folder Initialization process
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

    const movie = mediaMetadata.movie
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

      const releaseYear =
        movie.airDate && movie.airDate.length >= 4
          ? movie.airDate.slice(0, 4)
          : ""

      const response = await newFileName({
        ruleName: selectedNamingRule,
        type: "movie",
        seasonNumber: 0,
        episodeNumber: 0,
        episodeName: "",
        tvshowName: movie.name || "",
        file: videoFile.path,
        tmdbId: movie.id?.toString() || "",
        releaseYear,
        movieName: movie.name || "",
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
  const handleSelectResult = useCallback(async (args: SearchResultSelectedArgs) => {
    debug(`[MoviePanel] handleSelectResult() called`, {
      args,
    })

    if(rawMediaMetadata === undefined) {
      console.error(`[MoviePanel] handleSelectResult() rawMediaMetadata is undefined, skip`)
      return
    }

    const { database, result, searchLanguage } = args

    const traceId = `MovieSearchResultSelected-${nextTraceId()}`
    const mediaFolderPath = rawMediaMetadata.mediaFolderPath!

    updateMediaMetadata(mediaFolderPath, {
      ...rawMediaMetadata,
      status: 'updating',
    }, { traceId })

    if(database === 'TVDB') {

      updateMediaMetadata(
        mediaFolderPath,
        (prev) => ({
          ...prev,
          status: "updating",
        }),
        { traceId },
      )

      getTvdbMovie(
        {
          movieId: parseInt(String(result.tvdb_id), 10),
          language: searchLanguage,
        },
        {
          onSuccess: (movie) => {
            updateMediaMetadata(
              mediaFolderPath,
              (prev) => ({
                ...prev,
                movie,
                status: "ok",
              }),
              { traceId },
            )
          },
          onError: (error) => {
            console.error("Failed to get TVDB movie:", error)
            toast.error(`Unable to fetch data from TVDB: ${error.message}`)
            updateMediaMetadata(
              mediaFolderPath,
              (prev) => ({
                ...prev,
                status: "ok",
              }),
              { traceId },
            )
          },
        },
      )

    } else if(database === 'TMDB') {

      updateMediaMetadata(
        mediaFolderPath,
        (prev) => ({
          ...prev,
          status: "updating",
        }),
        { traceId },
      )
      
      getTmdbMovie(
        {
          id: parseInt(String(result.id), 10),
          language: searchLanguage,
        },
        {
          onSuccess: (movie) => {
            updateMediaMetadata(
              mediaFolderPath,
              (prev) => ({
                ...prev,
                movie,
                status: "ok",
              }),
              { traceId },
            )
          },
          onError: (error) => {
            console.error("Failed to get TMDB movie:", error)
            toast.error(`Unable to fetch data from TMDB: ${error.message}`)
            updateMediaMetadata(
              mediaFolderPath,
              (prev) => ({
                ...prev,
                status: "ok",
              }),
              { traceId },
            )
          },
        },
      )

    } else {
      toast.error("Invalid database")
      return
    }

    
  }, [updateMediaMetadata, rawMediaMetadata, getTvdbMovie, getTmdbMovie])

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
          selectedMediaMetadata={mediaMetadata ? { ...mediaMetadata, status: (rawMediaMetadata as UIMediaMetadata | undefined)?.status ?? 'ok' } as UIMediaMetadata : undefined}
          openScrape={openScrape}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {(rawMediaMetadata as UIMediaMetadata | undefined)?.status === "initializing" ? (
          <MediaPanelInitializingHint />
        ) : (
          <MovieEpisodeTable
            key={mediaMetadata?.mediaFolderPath ?? "no-folder"}
            data={tableData}
            mediaFolderPath={mediaMetadata?.mediaFolderPath}
            preview={isPreviewingForRename}
          />
        )}
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
