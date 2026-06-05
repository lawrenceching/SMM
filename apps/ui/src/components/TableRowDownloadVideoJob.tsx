import { useCallback } from "react"
import { useTranslation } from "@/lib/i18n"
import type { JobTableRowData } from "./MusicFileTable"
import { useYtdlpDownloadProgressQuery } from "@/hooks/useYtdlpDownloadProgressQuery"
import { UITableRowDownloadVideoJob } from "./UITableRowDownloadVideoJob"

export interface TableRowDownloadVideoJobProps {
  row: JobTableRowData
  mediaFolderPath?: string
  hasRunningDownload?: boolean
  onDownloadStart?: (jobId: string) => void
  onDownloadStop?: (jobId: string) => void
  onDownloadRemove?: (jobId: string) => void
  isMultiSelectMode?: boolean
  selectedTrackIds?: number[]
  onSelectedTrackIdsChange?: (ids: number[]) => void
}

/**
 * Business-logic wrapper around {@link UITableRowDownloadVideoJob}.
 *
 * Responsibilities:
 *   - Poll the CLI command log for live download progress
 *     (reuses the same TanStack Query cache as BackgroundJobsPopover
 *     — no duplicate log fetches when both views are mounted).
 *   - Manage multi-select state (derive `isSelected`, provide toggle).
 *   - Inject the i18n `t` function into the pure UI component.
 *   - Bind the `jobId` to the start/stop/remove callbacks.
 *
 * Renders no DOM of its own; delegates everything to
 * {@link UITableRowDownloadVideoJob}.
 */
export function TableRowDownloadVideoJob({
  row,
  mediaFolderPath,
  hasRunningDownload = false,
  onDownloadStart,
  onDownloadStop,
  onDownloadRemove,
  isMultiSelectMode = false,
  selectedTrackIds = [],
  onSelectedTrackIdsChange,
}: TableRowDownloadVideoJobProps) {
  const { t } = useTranslation(["components"])

  const isSelected = selectedTrackIds.includes(row.id)
  const isDownloading = row.status === "downloading"

  const toggleSelect = useCallback(() => {
    if (!onSelectedTrackIdsChange) return
    const next = isSelected
      ? selectedTrackIds.filter((id) => id !== row.id)
      : [...selectedTrackIds, row.id]
    onSelectedTrackIdsChange(next)
  }, [isSelected, onSelectedTrackIdsChange, row.id, selectedTrackIds])

  // Real-time download progress, polled from CLI command log.
  // Reuses the same TanStack Query cache as BackgroundJobsPopover
  // — no duplicate log fetches when both views are mounted.
  const { progress: liveProgress } = useYtdlpDownloadProgressQuery({
    executionId: row.executionId ?? "",
    isRunning: isDownloading,
  })

  return (
    <UITableRowDownloadVideoJob
      row={row}
      mediaFolderPath={mediaFolderPath}
      isSelected={isSelected}
      isMultiSelectMode={isMultiSelectMode}
      onToggleSelect={toggleSelect}
      hasRunningDownload={hasRunningDownload}
      onDownloadStart={() => onDownloadStart?.(row.jobId)}
      onDownloadStop={() => onDownloadStop?.(row.jobId)}
      onDownloadRemove={() => onDownloadRemove?.(row.jobId)}
      liveProgress={liveProgress}
      t={t}
    />
  )
}
