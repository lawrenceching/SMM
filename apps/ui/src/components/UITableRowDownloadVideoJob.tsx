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
import type { JobTableRowData } from "./MusicFileTable"
import type { YtdlpDownloadProgress } from "@/hooks/useYtdlpDownloadProgressQuery"
import { MusicRowMediaCells } from "./musicTableRowShared"
import { cn } from "@/lib/utils"

const subgridRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "subgrid",
  gridColumn: "1 / -1",
}

function formatDownloadSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "0 B/s"
  if (bytesPerSecond >= 1_000_000) {
    return `${(bytesPerSecond / 1_000_000).toFixed(1)} MB/s`
  }
  if (bytesPerSecond >= 1_000) {
    return `${(bytesPerSecond / 1_000).toFixed(0)} KB/s`
  }
  return `${bytesPerSecond} B/s`
}

function formatDownloadEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return ""
  if (seconds === 0) return "0s"
  if (seconds < 60) return `${Math.max(1, Math.ceil(seconds))}s`
  const totalSec = Math.ceil(seconds)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m ${secs}s`
}

/**
 * Compose speed/ETA into a single compact label for the duration cell.
 * Falls back to the existing `…` placeholder when no live data is available.
 */
function formatLiveLabel(speedBps: number | undefined, etaSeconds: number | undefined): string {
  const parts: string[] = []
  if (speedBps != null) {
    const speed = formatDownloadSpeed(speedBps)
    if (speed !== "0 B/s") parts.push(speed)
  }
  if (etaSeconds != null) {
    const eta = formatDownloadEta(etaSeconds)
    if (eta) parts.push(eta)
  }
  return parts.length > 0 ? parts.join(" · ") : "…"
}

/**
 * Pure presentation component for a download-video job row.
 *
 * Knows nothing about how `liveProgress` is fetched or how selection state
 * is managed — those are the caller's responsibility. The component:
 *   - Derives `isDownloading` from `row.status`
 *   - Clamps `livePercent` to [0, 100] and formats the speed/ETA label
 *   - Renders the status icon, progress fill, media cells, and context menu
 *
 * The translation function is injected via `t` so this component can be
 * rendered in Storybook without an i18n provider.
 */
export interface UITableRowDownloadVideoJobProps {
  row: JobTableRowData
  mediaFolderPath?: string
  isSelected: boolean
  isMultiSelectMode: boolean
  onToggleSelect: () => void
  hasRunningDownload: boolean
  onDownloadStart: () => void
  onDownloadStop: () => void
  onDownloadRemove: () => void
  /** Raw progress snapshot from `useYtdlpDownloadProgressQuery`. */
  liveProgress: YtdlpDownloadProgress | null
  /** Injected i18n translation function. */
  t: (key: string) => string
  /** Override for the "downloading" tooltip translation key. */
  downloadingTooltipKey?: string
}

export function UITableRowDownloadVideoJob({
  row,
  mediaFolderPath,
  isSelected,
  isMultiSelectMode,
  onToggleSelect,
  hasRunningDownload,
  onDownloadStart,
  onDownloadStop,
  onDownloadRemove,
  liveProgress,
  t,
  downloadingTooltipKey = "mediaPlayer.downloadingTooltip",
}: UITableRowDownloadVideoJobProps) {
  const isDownloading = row.status === "downloading"
  const downloadingTooltip = isDownloading ? t(downloadingTooltipKey) : undefined
  const livePercent = isDownloading
    ? Math.max(0, Math.min(100, liveProgress?.percent ?? 0))
    : 0
  const liveLabel = isDownloading
    ? formatLiveLabel(liveProgress?.speedBps, liveProgress?.etaSeconds ?? undefined)
    : undefined

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          style={subgridRowStyle}
          role="row"
          data-testid={`music-job-row-${row.id}`}
          data-status={row.status}
          data-percent={isDownloading ? livePercent : undefined}
          className={cn(
            "relative isolate cursor-pointer group",
            isSelected ? "bg-muted" : "",
          )}
          onClick={() => {
            if (isDownloading) return
            if (isMultiSelectMode) {
              onToggleSelect()
            }
          }}
        >
          {isDownloading && (
            <div
              aria-hidden="true"
              data-testid={`music-job-row-${row.id}-progress-fill`}
              className="absolute inset-y-0 left-0 -z-10 bg-primary/20 transition-[width] duration-200 ease-linear pointer-events-none"
              style={{ width: `${livePercent}%` }}
            />
          )}
          <div
            role="cell"
            className="relative w-10 px-2 py-1.5 text-center flex items-center justify-center"
          >
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
                  onChange={onToggleSelect}
                  data-testid={`music-file-row-checkbox-${row.id}`}
                  aria-label={`select-row-${row.id}`}
                  className="size-4 cursor-pointer"
                />
              ) : (
                <Clock className="size-4 text-muted-foreground" />
              )}
            </div>
          </div>

          <MusicRowMediaCells
            title={row.title}
            artist={row.artist}
            duration={row.duration}
            thumbnail={row.thumbnail}
            mediaFolderPath={mediaFolderPath}
            isSelected={isSelected}
            durationLabel={liveLabel}
            as="div"
          />

          <div role="cell" />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {row.status !== "downloading" && row.status !== "completed" && (
          <ContextMenuItem
            disabled={hasRunningDownload}
            onClick={onDownloadStart}
          >
            <CirclePlay className="mr-2 size-4" />
            {t("mediaPlayer.trackContextMenu.downloadStart")}
          </ContextMenuItem>
        )}
        {row.status === "downloading" && (
          <ContextMenuItem onClick={onDownloadStop}>
            <CircleStop className="mr-2 size-4" />
            {t("mediaPlayer.trackContextMenu.downloadStop")}
          </ContextMenuItem>
        )}
        <ContextMenuItem
          variant="destructive"
          onClick={onDownloadRemove}
        >
          <CircleX className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.downloadRemove")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
