import { useUIMediaFolderStoreState } from "@/stores/uiMediaFolderStore"
import { useMediaMetadataQuery } from "@/hooks/mediaMetadata"
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import { useState, useEffect, useCallback, useMemo } from "react"
import { generateNewFileName } from "@/lib/renameRules"
import { join, extname } from "@/lib/path"
import { useLatest } from "react-use"
import { useDialogs } from "@/providers/dialog-provider"
import { useFetchMediaMetadataMutation } from "@/hooks/mediaMetadata/useFetchMediaMetadataMutation"
import { useSelectMovieForFolderMutation } from "@/hooks/movie/useSelectMovieForFolderMutation"
import { renameFiles } from "@/api/renameFiles"
import { toast } from "sonner"
import { findMediaFilesForMovieMediaMetadata } from "@/helpers/movie/MovieMediaMetadataUtils"
import {
  buildMovieFilesFromMediaMetadata,
  type MovieFileModel,
} from "@/helpers/movie/buildMovieFilesFromMediaMetadata"
import { buildMovieEpisodeTableRows, type MovieRenamePreviewData } from "@/lib/buildMovieEpisodeTableRows"
import type { MediaMetadata } from "@core/types"
import type { UIMediaFolderStatus } from "@/types/UIMediaFolder"
import { MovieHeaderV2 } from "./MovieHeaderV2"
import type { EpisodeTableLayout } from "../tv/TvShowPanelHeader"
import { MediaFileTable } from "../media/MediaFileTable"
import type {
  UIMediaFileDataContextMenuItem,
  UIMediaFileTableRow,
} from "../media/UIMediaFileTable"
import { useRenameVideoFileFlow } from "@/hooks/useRenameVideoFileFlow"
import { TvShowEpisodeTable, type TvShowEpisodeDataRow, type TvShowEpisodeTableRow } from "../tv/TvShowEpisodeTable"
import { RuleBasedRenameFilePrompt } from "../RuleBasedRenameFilePrompt"
import { MediaPanelInitializingHint } from "../MediaPanelInitializingHint"
import type { SearchResultSelectedArgs } from "../MediaDatabaseSearchbox"
import { TranscribeDialog, SubtitleTranslationDialog, SynthesizeSubtitleDialog, ProcessPipelineDialog } from "@/components/dialogs"
import { useFeatures } from "@/hooks/useFeatures"
import { useSubtitleFlow } from "@/hooks/useSubtitleFlow"
import { useTranslation } from "react-i18next"
import Debug from 'debug'
const debug = Debug('MoviePanel')
export type { MovieFileModel } from "@/helpers/movie/buildMovieFilesFromMediaMetadata"

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

  const folderStatus = useMemo((): UIMediaFolderStatus => {
    if (!selectedFolder?.trim()) return "idle"
    if (isMediaMetadataError) return "error_loading_metadata"
    if (queriedMediaMetadata) return "ok"
    if (uiFolderRow?.status) return uiFolderRow.status
    if (isMediaMetadataPending || mediaMetadataFetchStatus === "fetching") return "initializing"
    return "loading"
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

  // Layout state for the episode table (simple / detail / preview)
  const [layout, setLayout] = useState<EpisodeTableLayout>("simple")


  /**
   * Frontend-processed media metadata. Adjustments here should not persist to backend.
   */
  const mediaMetadata: MediaMetadata | undefined = useMemo(() => {
    if (!queriedMediaMetadata) {
      return undefined
    }

    const clone: MediaMetadata = structuredClone(queriedMediaMetadata)

    // move this step to Media Folder Initialization process
    return findMediaFilesForMovieMediaMetadata(clone)
  }, [queriedMediaMetadata])

  const { isVideoCompressionEnabled, isUseMediaFileTableEnabled } = useFeatures()

  const subtitleFlow = useSubtitleFlow({
    mediaMetadata,
    uiStatus: folderStatus,
    onRefreshMediaMetadata: refreshMediaMetadata,
  })
  const videoRenameFlow = useRenameVideoFileFlow({
    mediaFolderPath: mediaMetadata?.mediaFolderPath,
    files: mediaMetadata?.files ?? [],
  })
  const [movieFiles, setMovieFiles] = useState<MovieFileModel>({ files: [] })
  const latestMovieFiles = useLatest(movieFiles)

  // Merge base files with preview modifications
  useEffect(() => {
    const model = buildMovieFilesFromMediaMetadata(mediaMetadata)
    if (model) {
      setMovieFiles(model)
    }
  }, [mediaMetadata])

  // Compute preview mode from prompt states
  const isPreviewingForRename = useMemo(() => {
    return isRuleBasedRenameFilePromptOpen
  }, [isRuleBasedRenameFilePromptOpen])

  // Extracts MovieRenamePreviewData from movieFiles when rename prompt is open,
  // so the adapter can fill newVideoFile/newSubtitle/newNfo on the episode row.
  const renamePreview = useMemo<MovieRenamePreviewData | null>(() => {
    if (!isPreviewingForRename) return null
    const videoRow = latestMovieFiles.current.files.find((f) => f.type === "video")
    const subtitleRow = latestMovieFiles.current.files.find((f) => f.type === "subtitle")
    const nfoRow = latestMovieFiles.current.files.find((f) => f.type === "nfo")
    return {
      newVideoFile: videoRow?.newPath,
      newSubtitle: subtitleRow?.newPath,
      newNfo: nfoRow?.newPath,
    }
  }, [latestMovieFiles, isPreviewingForRename])

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

    const videoFilePath = videoFile.path
    const videoNewPath = generatedFilePath
    const videoNewRelativePath = generatedFileRelativePath
    const videoStem = videoNewRelativePath.replace(extname(videoNewRelativePath), '')

    setMovieFiles((prev) => ({
      ...prev,
      files: prev.files.map((file) => {
        if (file.type === "video") {
          return { ...file, newPath: videoNewPath }
        }
        if (file.path === videoFilePath) {
          return file
        }
        // Associated file: keep the same folder, swap its stem to the new video stem
        const assocExt = extname(file.path)
        const assocRelativeNewPath = join(mediaMetadata.mediaFolderPath!, `${videoStem}${assocExt}`)
        return { ...file, newPath: assocRelativeNewPath }
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

      if (queriedMediaMetadata === undefined) {
        console.error(`[MoviePanel] handleSelectResult() queriedMediaMetadata is undefined, skip`)
        return
      }

      const path = queriedMediaMetadata.mediaFolderPath
      if (!path) {
        console.error(`[MoviePanel] handleSelectResult() mediaFolderPath is missing, skip`)
        return
      }

      selectMovieForFolderMutation.mutate({
        mediaFolderPath: path,
        baseMetadata: queriedMediaMetadata,
        ...args,
      })
    },
    [queriedMediaMetadata, selectMovieForFolderMutation],
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

  // Build table data using the movie→tv-show adapter
  const tableData = useMemo<TvShowEpisodeTableRow[]>(() => {
    if (!mediaMetadata) return []
    return buildMovieEpisodeTableRows(mediaMetadata, folderStatus, (key: string) => t(key as any), {
      renamePreview: renamePreview ?? undefined,
    })
  }, [mediaMetadata, folderStatus, t, renamePreview])

  const handleVideoCompressClick = useCallback(
    (row: TvShowEpisodeDataRow) => {
      if (!row.videoFile) return
      const [openVideoCompression] = videoCompressionDialog
      openVideoCompression({ filePath: row.videoFile })
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
          selectedMediaMetadata={mediaMetadata}
          selectedMediaFolder={uiFolderRow}
          openScrape={openScrape}
          episodeTableLayout={layout}
          onEpisodeTableLayoutChange={setLayout}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {folderStatus === "initializing" ? (
          <MediaPanelInitializingHint />
        ) : isUseMediaFileTableEnabled ? (
          <MediaFileTable
            key={mediaMetadata?.mediaFolderPath ?? "no-folder"}
            data={tableData as UIMediaFileTableRow[]}
            mediaFolderPath={mediaMetadata?.mediaFolderPath}
            layout={isPreviewingForRename ? "simple" : layout}
            preview={isPreviewingForRename ? "rename" : undefined}
            extraEpisodeContextMenu={[{
              id: "rename",
              label: t("episodeFile.rename"),
              onClick: videoRenameFlow.onRenameContextMenuClick,
              disabled: (row) => !row.videoFile,
            } satisfies UIMediaFileDataContextMenuItem]}
          />
        ) : (
          <TvShowEpisodeTable
            key={mediaMetadata?.mediaFolderPath ?? "no-folder"}
            data={tableData}
            mediaFolderPath={mediaMetadata?.mediaFolderPath}
            layout={isPreviewingForRename ? "simple" : layout}
            preview={isPreviewingForRename ? "rename" : undefined}
            onVideoCompressContextMenuClick={isVideoCompressionEnabled ? handleVideoCompressClick : undefined}
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
