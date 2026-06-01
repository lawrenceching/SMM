/**
 * Orchestrator: resolves subtitle pipeline state, fetches associated files,
 * monitors running background jobs correlated to this row's media file, and
 * delegates all UI rendering to {@link UILocalFileTableRow}.
 */
import { useMemo, useState, useCallback } from "react"
import type { LocalFileTableRowData } from "./MusicFileTable"
import { useLocalFileSubtitle } from "./LocalFileSubtitleScope"
import { UILocalFileTableRow } from "./UILocalFileTableRow"
import type {
  MusicTableSelection,
  LocalFileTableRowFileMenu,
} from "@/types/music-table"
import type { RunningJob } from "@/types/associated-files"
import { useGetAssociatedFiles } from "@/hooks/useGetAssociatedFiles"
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore"
import { absolutePosixMusicFilePath } from "@/lib/transcribeDialogRows"
import type { BackgroundJob } from "@/types/background-jobs"
import { isTranscribeBackgroundJob, isTranslateBackgroundJob, isSynthesizeBackgroundJob, isProcessBackgroundJob } from "@/types/background-jobs"
import { readFile } from "@/api/readFile"
import { useConfig } from "@/hooks/userConfig/useConfig"
import { summarizeVideo } from "@/lib/summarizeVideo"
import { findAndWriteSummaryFile } from "@/lib/summarizeFilename"
import { Path } from "@core/path"
import { toast } from "sonner"
import { useTranslation, castTranslationFn } from "@/lib/i18n"

export type { LocalFileTableRowData } from "./MusicFileTable"
export type { MusicTableSelection, LocalFileTableRowFileMenu } from "@/types/music-table"

export interface LocalFileTableRowProps {
  row: LocalFileTableRowData
  mediaFolderPath?: string
  selection: MusicTableSelection
  fileMenu: LocalFileTableRowFileMenu
  onTrackClick?: (trackId: number) => void
}

function jobTypeToRunningJobType(
  job: BackgroundJob,
): RunningJob["type"] | null {
  if (isTranscribeBackgroundJob(job)) return "transcribing"
  if (isTranslateBackgroundJob(job)) return "translating"
  if (isSynthesizeBackgroundJob(job)) return "synthesising"
  if (isProcessBackgroundJob(job)) return "processing"
  return null
}

export function LocalFileTableRow({
  row,
  mediaFolderPath,
  selection,
  fileMenu,
  onTrackClick,
}: LocalFileTableRowProps) {
  const { t: tStrict } = useTranslation(["components"])
  const t = castTranslationFn(tStrict)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const subtitle = useLocalFileSubtitle()
  const isSelected = selection.selectedTrackIds.includes(row.id)
  const subtitleUi = subtitle.getRowSubtitleUi(
    row,
    selection.isMultiSelectMode,
    isSelected,
  )
  const subtitleActions = subtitle.bindRowActions(row)

  const absPath = absolutePosixMusicFilePath(row, mediaFolderPath)

  const associatedFiles = useGetAssociatedFiles(
    mediaFolderPath,
    absPath,
  )

  const hasSubtitle = useMemo(
    () => associatedFiles.some((f) => f.type === "subtitle"),
    [associatedFiles],
  )
  const canSummarize = hasSubtitle && !isSummarizing

  const { appConfig, userConfig } = useConfig()

  const jobs = useBackgroundJobsStore((state) => state.jobs)
  const matchingJobs = useMemo(() => {
    if (!absPath) return []
    return jobs
      .filter((job) => {
        if (job.status !== "running") return false
        const d = job.data as Record<string, unknown> | null
        if (!d) return false
        return (
          d.mediaPath === absPath ||
          d.videoPath === absPath ||
          d.subtitlePath === absPath
        )
      })
      .map((job) => {
        const type = jobTypeToRunningJobType(job)
        return type ? { id: job.id, jobType: type } : null
      })
      .filter((v): v is { id: string; jobType: RunningJob["type"] } => v !== null)
  }, [jobs, absPath])

  const handleSummarize = useCallback(async () => {
    if (!absPath || !mediaFolderPath) {
      toast.error(t("mediaPlayer.trackContextMenu.summarizeError"))
      return
    }

    // Find the subtitle file path
    const subtitleFile = associatedFiles.find((f) => f.type === "subtitle")
    if (!subtitleFile) {
      toast.error(t("mediaPlayer.trackContextMenu.summarizeNoSubtitle"))
      return
    }

    // Resolve AI config
    const selectedName = userConfig.selectedAIProvider
    if (!selectedName) {
      toast.error(t("mediaPlayer.trackContextMenu.summarizeNoDefaultAi"))
      return
    }
    const aiProvider = userConfig.aiProviders?.find((p) => p.name === selectedName)
    if (!aiProvider) {
      toast.error(t("mediaPlayer.trackContextMenu.summarizeNoAiConfig"))
      return
    }
    if (!aiProvider.baseURL) {
      toast.error((tStrict as any)("mediaPlayer.trackContextMenu.summarizeNoBaseUrl", { name: aiProvider.name }))
      return
    }
    if (!aiProvider.model) {
      toast.error((tStrict as any)("mediaPlayer.trackContextMenu.summarizeNoModel", { name: aiProvider.name }))
      return
    }
    const reverseProxyUrl = appConfig.reverseProxyUrl
    if (!reverseProxyUrl) {
      toast.error(t("mediaPlayer.trackContextMenu.summarizeNoProxy"))
      return
    }

    setIsExpanded(true)
    setIsSummarizing(true)

    try {
      // Step 1: Read subtitle file
      const subtitleFilePath = Path.toPlatformPath(subtitleFile.path)
      const readResult = await readFile(subtitleFilePath)
      if (readResult.error || !readResult.data) {
        throw new Error(readResult.error ?? "Failed to read subtitle file")
      }

      // Step 2: Generate summary via AI
      const summary = await summarizeVideo({
        subtitleContent: readResult.data,
        aiProvider,
        reverseProxyUrl,
      })

      // Step 3: Write summary file
      const videoPlatformPath = Path.toPlatformPath(absPath)
      const outputPath = await findAndWriteSummaryFile(videoPlatformPath, summary)

      setIsSummarizing(false)
      toast.success(
        (tStrict as any)("mediaPlayer.trackContextMenu.summarizeSuccess", { path: outputPath }),
      )
    } catch (error) {
      setIsSummarizing(false)
      console.error("[LocalFileTableRow] Summarize failed:", error)
      toast.error(
        (tStrict as any)("mediaPlayer.trackContextMenu.summarizeFailed", {
          error: error instanceof Error ? error.message : String(error),
        }),
      )
    }
  }, [absPath, mediaFolderPath, associatedFiles, userConfig, appConfig, t])

  return (
    <UILocalFileTableRow
      row={row}
      mediaFolderPath={mediaFolderPath}
      isSelected={isSelected}
      isExpanded={isExpanded}
      selection={selection}
      subtitleUi={subtitleUi}
      subtitleActions={subtitleActions}
      fileMenu={fileMenu}
      onTrackClick={onTrackClick}
      onToggleExpand={() => setIsExpanded((prev) => !prev)}
      associatedFiles={associatedFiles}
      matchingJobs={matchingJobs}
      isSummarizing={isSummarizing}
      onSummarize={handleSummarize}
      canSummarize={canSummarize}
    />
  )
}
