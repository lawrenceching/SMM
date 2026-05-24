/**
 * Orchestrator: resolves subtitle pipeline state, fetches associated files,
 * monitors running background jobs correlated to this row's media file, and
 * delegates all UI rendering to {@link UILocalFileTableRow}.
 */
import { useMemo, useState } from "react"
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
  const [isExpanded, setIsExpanded] = useState(false)
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
    />
  )
}
