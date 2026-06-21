import { useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"
import { useMediaMetadataQuery } from "@/hooks/mediaMetadata"
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import { useState, useEffect, useCallback, useMemo } from "react"
import type { FileProps } from "@/lib/types"
import { generateNewFileName } from "@/lib/renameRules"
import { join } from "@/lib/path"
import { useLatest } from "react-use"
import { useDialogs } from "@/providers/dialog-provider"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import { useSelectMovieForFolderMutation } from "@/hooks/movie/useSelectMovieForFolderMutation"
import { renameFiles } from "@/api/renameFiles"
import { toast } from "sonner"
import { findMediaFilesForMovieMediaMetadata } from "@/helpers/movie/MovieMediaMetadataUtils"
import type { MediaMetadata } from "@core/types"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import { MovieHeaderV2 } from "./MovieHeaderV2"
import { MovieEpisodeTable, type MovieFileRow } from "./MovieEpisodeTable"
import { RuleBasedRenameFilePrompt } from "../RuleBasedRenameFilePrompt"
import { MediaPanelInitializingHint } from "../MediaPanelInitializingHint"
import type { SearchResultSelectedArgs } from "../MediaDatabaseSearchbox"
import { TranscribeDialog, SubtitleTranslationDialog, SynthesizeSubtitleDialog, ProcessPipelineDialog } from "@/components/dialogs"
import { useFeatures } from "@/hooks/useFeatures"
import { useSubtitleFlow } from "@/hooks/useSubtitleFlow"
import { useTranslation } from "react-i18next"
import Debug from 'debug'
const debug = Debug('MoviePanel')
export interface MovieFileModel {
    files: FileProps[]
}

interface ToolbarOption {
  value: "plex" | "emby",
  label: string,
}

function MoviePanel() {
  const { t } = useTranslation('components')
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
  const { selectMovieForFolderMutation } = useSelectMovieForFolderMutation()
  const refreshMediaMetadata = useCallback(
    async (path: string, options?: { traceId?: string }) => {
      await fetchMediaMetadata({ path, traceId: options?.traceId })
    },
    [fetchMediaMetadata],
  )
  const { scrapeDialog, videoCompressionDialog } = useDialogs()
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

  const { isVideoCompressionEnabled } = useFeatures()

  const subtitleFlow = useSubtitleFlow({
    mediaMetadata,
    uiStatus: rawMediaMetadata?.status,
    onRefreshMediaMetadata: refreshMediaMetadata,
  })
  const [movieFiles, setMovieFiles] = useState<MovieFileModel>({ files: [] })
  const latestMovieFiles = useLatest(movieFiles)

  // Merge base files with preview modifications
  useEffect(() => {
    if (!mediaMetadata) {
      return
    }

    const model: MovieFileModel = {
      files: [],
    }

    for (const file of mediaMetadata.mediaFiles || []) {
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

    if (!isRuleBasedRenameFilePromptOpen) {
      return
    }

    if (!selectedNamingRule) {
      console.log(
        `[MoviePanel] generateNewFileNames() selectedNamingRule is undefined, skip generation`,
      )
      return
    }

    if (mediaMetadata === undefined || mediaMetadata.mediaFolderPath === undefined) {
      console.error(
        `[MoviePanel] generateNewFileNames() mediaMetadata is undefined or mediaFolderPath is undefined, skip generation`,
      )
      return
    }

    const movie = mediaMetadata.movie
    if (!movie) {
      console.error(`[MoviePanel] generateNewFileNames() movie is undefined, skip generation`)
      return
    }

    const videoFile = latestMovieFiles.current.files.find((file) => file.type === "video")

    if (videoFile === undefined) {
      console.error(`Video file is undefined for movie`)
      return
    }

    const releaseYear =
      movie.airDate && movie.airDate.length >= 4 ? movie.airDate.slice(0, 4) : ""

    const generatedFileRelativePath = generateNewFileName(selectedNamingRule, {
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

    const generatedFilePath = join(mediaMetadata.mediaFolderPath!, generatedFileRelativePath)

    if (videoFile.path === generatedFilePath) {
      console.log(
        `[MoviePanel] the current file has been named follow the ${selectedNamingRule} rule, don't need to regenerate`,
      )
      return
    }

    setMovieFiles((prev) => ({
      ...prev,
      files: prev.files.map((file) => {
        if (file.type === "video") {
          return { ...file, newPath: generatedFilePath }
        }
        return file
      }),
    }))
  }, [isRuleBasedRenameFilePromptOpen, mediaMetadata, selectedNamingRule, movieFiles])

  useEffect(() => {
    if (isRuleBasedRenameFilePromptOpen) {
      generateNewFileNames()
    }
  }, [isRuleBasedRenameFilePromptOpen, generateNewFileNames])

  const handleSelectResult = useCallback(
    (args: SearchResultSelectedArgs) => {
      debug(`[MoviePanel] handleSelectResult() called`, { args })

      if (rawMediaMetadata === undefined) {
        console.error(`[MoviePanel] handleSelectResult() rawMediaMetadata is undefined, skip`)
        return
      }

      const path = rawMediaMetadata.mediaFolderPath
      if (!path) {
        console.error(`[MoviePanel] handleSelectResult() mediaFolderPath is missing, skip`)
        return
      }

      selectMovieForFolderMutation.mutate({
        mediaFolderPath: path,
        baseMetadata: rawMediaMetadata,
        ...args,
      })
    },
    [rawMediaMetadata, selectMovieForFolderMutation],
  )

  // Handle confirm button click - rename all files
  const handleRuleBasedRenameConfirm = useCallback(async () => {
    if (!mediaMetadata?.mediaFolderPath) {
      toast.error(t('movie.noMediaPathError', { ns: 'components' }))
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
      toast.info(t('movie.renameNoFiles', { ns: 'components' }))
      setIsRuleBasedRenameFilePromptOpen(false)
      return
    }

    setIsRenaming(true)

    try {
      await renameFiles({ files: filesToRename })
      await refreshMediaMetadata(mediaMetadata.mediaFolderPath)
      toast.success(t('movie.renameSuccess', { ns: 'components', count: filesToRename.length }))
    } catch (error) {
      console.error("Rename failed:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      toast.error(t('movie.renameFailed', { ns: 'components', error: errorMessage }))
    } finally {
      setIsRenaming(false)
      setIsRuleBasedRenameFilePromptOpen(false)
    }
  }, [mediaMetadata, latestMovieFiles, refreshMediaMetadata, t])

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

  const handleVideoCompressClick = useCallback(
    (filePath: string) => {
      const [openVideoCompression] = videoCompressionDialog
      openVideoCompression({ filePath })
    },
    [videoCompressionDialog],
  )

  return (
    <div className='w-full h-full min-h-0 relative flex flex-col'>
      <TranscribeDialog {...subtitleFlow.dialogs.transcribe} />
      <SubtitleTranslationDialog {...subtitleFlow.dialogs.translate} />
      <SynthesizeSubtitleDialog {...subtitleFlow.dialogs.synthesize} />
      <ProcessPipelineDialog {...subtitleFlow.dialogs.pipeline} />

      <div className="shrink-0 px-4 pt-4">
        <MovieHeaderV2
          onSearchResultSelected={handleSelectResult}
          onRenameClick={() => setIsRuleBasedRenameFilePromptOpen(true)}
          showSubtitleMenu={subtitleFlow.showSubtitleMenu}
          {...subtitleFlow.header}
          selectedMediaMetadata={
            mediaMetadata && rawMediaMetadata
              ? ({ ...mediaMetadata, status: rawMediaMetadata.status } satisfies UIMediaMetadata)
              : undefined
          }
          selectedMediaFolder={uiFolderRow}
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
            onVideoCompressClick={isVideoCompressionEnabled ? handleVideoCompressClick : undefined}
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
