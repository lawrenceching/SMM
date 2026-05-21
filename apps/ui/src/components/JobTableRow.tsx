import {
  TableCell,
  TableRow,
} from "@/components/ui/table"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  CirclePlay,
  CircleStop,
  CircleX,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { useTranslation } from "@/lib/i18n"
import type { JobTableRowData } from "./MusicFileTable"
import { MusicRowMediaCells } from "./musicTableRowShared"

export type { JobTableRowData } from "./MusicFileTable"

export interface JobTableRowProps {
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

export function JobTableRow({
  row,
  mediaFolderPath,
  hasRunningDownload,
  onDownloadStart,
  onDownloadStop,
  onDownloadRemove,
  isMultiSelectMode = false,
  selectedTrackIds = [],
  onSelectedTrackIdsChange,
}: JobTableRowProps) {
  const { t } = useTranslation(["components"])

  const toggleTrackSelection = (trackId: number) => {
    const next = selectedTrackIds.includes(trackId)
      ? selectedTrackIds.filter((id) => id !== trackId)
      : [...selectedTrackIds, trackId]
    onSelectedTrackIdsChange?.(next)
  }

  const isSelected = selectedTrackIds.includes(row.id)
  const isDownloading = row.status === "downloading"
  const downloadingTooltip = isDownloading
    ? t("mediaPlayer.downloadingTooltip")
    : undefined

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow
          className={`cursor-pointer group ${isSelected ? "bg-muted" : ""}`}
          onClick={() => {
            if (isDownloading) return
            if (isMultiSelectMode) {
              if (isSelected) {
                onSelectedTrackIdsChange?.(
                  selectedTrackIds.filter((id) => id !== row.id),
                )
              } else {
                onSelectedTrackIdsChange?.([...selectedTrackIds, row.id])
              }
            }
          }}
        >
          <TableCell className="w-10 px-2 py-1.5 text-center">
            <div className="flex items-center justify-center">
              {downloadingTooltip ? (
                <span
                  className="inline-flex cursor-default"
                  title={downloadingTooltip}
                  aria-label={downloadingTooltip}
                >
                  <Spinner className="size-4 text-primary" />
                </span>
              ) : row.status === "completed" ? (
                <CheckCircle2 className="size-4 text-green-500" />
              ) : row.status === "failed" ? (
                <XCircle className="size-4 text-red-500" />
              ) : row.status === "stopped" ? (
                <CircleStop className="size-4 text-orange-500" />
              ) : isMultiSelectMode || isSelected ? (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => toggleTrackSelection(row.id)}
                  data-testid={`music-file-row-checkbox-${row.id}`}
                  aria-label={`select-row-${row.id}`}
                  className="size-4 cursor-pointer"
                />
              ) : (
                <Clock className="size-4 text-muted-foreground" />
              )}
            </div>
          </TableCell>

          <MusicRowMediaCells
            title={row.title}
            artist={row.artist}
            duration={row.duration}
            thumbnail={row.thumbnail}
            mediaFolderPath={mediaFolderPath}
            isSelected={isSelected}
            durationLabel={isDownloading ? "..." : undefined}
          />
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {row.status !== "downloading" && row.status !== "completed" && (
          <ContextMenuItem
            disabled={hasRunningDownload}
            onClick={() => onDownloadStart?.(row.jobId)}
          >
            <CirclePlay className="mr-2 size-4" />
            {t("mediaPlayer.trackContextMenu.downloadStart")}
          </ContextMenuItem>
        )}
        {row.status === "downloading" && (
          <ContextMenuItem onClick={() => onDownloadStop?.(row.jobId)}>
            <CircleStop className="mr-2 size-4" />
            {t("mediaPlayer.trackContextMenu.downloadStop")}
          </ContextMenuItem>
        )}
        <ContextMenuItem
          variant="destructive"
          onClick={() => onDownloadRemove?.(row.jobId)}
        >
          <CircleX className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.downloadRemove")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
