import { isAbsPath, join } from "@/lib/path"
import { Path } from "@core/path"
import { pathToFileURL } from "@core/url"
import {
  TableCell,
  TableRow,
} from "@/components/ui/table"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import {
  FolderOpen,
  Trash2,
  FileText,
  Music,
  Tag,
  CirclePlay,
  CircleStop,
  CircleX,
  Clock,
  CheckCircle2,
  XCircle,
  Captions,
  Languages,
  FileVideo,
  Sparkles,
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import Image from "@/components/Image"
import { useTranslation } from "@/lib/i18n"

export interface MusicFileRow {
  id: number
  index: number
  title: string
  artist: string
  duration: number
  thumbnail?: string
  path?: string
  status?: "pending" | "downloading" | "completed" | "failed" | "stopped"
  jobId?: string
  /** Subtitle generation task for this file (IndexedDB + Service Worker). */
  transcribeStatus?: "running" | "failed"
  /** Subtitle translation task for this row's media path (IndexedDB + Service Worker). */
  translateStatus?: "running" | "failed"
  /** Subtitle synthesize / burn-in task (IndexedDB + Service Worker). */
  synthesizeStatus?: "running" | "failed"
  /** Full VideoCaptioner pipeline (IndexedDB + Service Worker). */
  processStatus?: "running" | "failed"
  canProcess?: boolean
  /** Sibling `.srt`/`.ass` exists in the media folder (see {@link subtitleTranslationDialogRowsFromMusicFileRows}). */
  canTranslate?: boolean
  /** Video + sibling subtitle available for synthesize (see {@link synthesizeSubtitleDialogRowsFromMusicFileRows}). */
  canSynthesize?: boolean
}

export interface MusicFileTableRowProps {
  row: MusicFileRow
  mediaFolderPath?: string
  currentTrackId?: number | null
  isPlaying?: boolean
  onTrackClick?: (trackId: number) => void
  hasRunningDownload?: boolean
  onDownloadStart?: (jobId: string) => void
  onDownloadStop?: (jobId: string) => void
  onDownloadRemove?: (jobId: string) => void
  isTranscribeAvailable?: boolean
  onTrackTranscribe?: (track: MusicFileRow) => void
  onTranscribeStop?: (track: MusicFileRow) => void
  isTranslateAvailable?: boolean
  onTrackTranslate?: (track: MusicFileRow) => void
  onTranslateStop?: (track: MusicFileRow) => void
  isSynthesizeAvailable?: boolean
  onTrackSynthesize?: (track: MusicFileRow) => void
  onSynthesizeStop?: (track: MusicFileRow) => void
  isProcessAvailable?: boolean
  onTrackProcess?: (track: MusicFileRow) => void
  onProcessStop?: (track: MusicFileRow) => void
  isMultiSelectMode?: boolean
  selectedTrackIds?: number[]
  onSelectedTrackIdsChange?: (ids: number[]) => void
  onTrackOpen?: (track: MusicFileRow) => void
  onTrackDelete?: (track: MusicFileRow) => void
  onTrackProperties?: (track: MusicFileRow) => void
  onTrackFormatConvert?: (track: MusicFileRow) => void
  onTrackEditTags?: (track: MusicFileRow) => void
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

/** Builds a file:// URL for the thumbnail that the backend can resolve. */
function getThumbnailImageUrl(thumbnailPath: string, mediaFolderPath: string | undefined): string {
  if (
    thumbnailPath.startsWith("http://") ||
    thumbnailPath.startsWith("https://") ||
    thumbnailPath.startsWith("file://")
  ) {
    return thumbnailPath
  }

  const absolutePath =
    mediaFolderPath && !isAbsPath(thumbnailPath)
      ? join(mediaFolderPath, thumbnailPath)
      : thumbnailPath
  const platformPath = Path.toPlatformPath(absolutePath)
  return pathToFileURL(platformPath)
}

function ThumbnailPreview({
  thumbnailPath,
  mediaFolderPath,
}: {
  thumbnailPath: string
  mediaFolderPath: string | undefined
}) {
  const url = getThumbnailImageUrl(thumbnailPath, mediaFolderPath)
  return (
    <Image
      url={url}
      alt=""
      className="max-h-[180px] w-auto rounded object-contain"
    />
  )
}

export function MusicFileTableRow({
  row,
  mediaFolderPath,
  onTrackClick,
  hasRunningDownload,
  onDownloadStart,
  onDownloadStop,
  onDownloadRemove,
  isTranscribeAvailable,
  onTrackTranscribe,
  onTranscribeStop,
  isTranslateAvailable,
  onTrackTranslate,
  onTranslateStop,
  isSynthesizeAvailable,
  onTrackSynthesize,
  onSynthesizeStop,
  isProcessAvailable,
  onTrackProcess,
  onProcessStop,
  isMultiSelectMode = false,
  selectedTrackIds = [],
  onSelectedTrackIdsChange,
  onTrackOpen,
  onTrackDelete,
  onTrackProperties,
  onTrackFormatConvert,
  onTrackEditTags,
}: MusicFileTableRowProps) {
  const { t } = useTranslation(["components"])

  const toggleTrackSelection = (trackId: number) => {
    const next = selectedTrackIds.includes(trackId)
      ? selectedTrackIds.filter((id) => id !== trackId)
      : [...selectedTrackIds, trackId]
    onSelectedTrackIdsChange?.(next)
  }

  const isSelected = selectedTrackIds.includes(row.id)
  const isDownloading = row.status === "downloading"
  const isTranscribing = row.transcribeStatus === "running"
  const isTranslating = row.translateStatus === "running"
  const isSynthesizing = row.synthesizeStatus === "running"
  const isProcessing = row.processStatus === "running"
  const translateDisabled =
    !row.path ||
    isDownloading ||
    !isTranslateAvailable ||
    !row.canTranslate ||
    isTranslating
  const synthesizeDisabled =
    !row.path ||
    isDownloading ||
    !isSynthesizeAvailable ||
    !row.canSynthesize ||
    isSynthesizing
  const transcribeItemDisabled =
    !row.path || isDownloading || !isTranscribeAvailable || isTranscribing
  const processItemDisabled =
    !row.path ||
    isDownloading ||
    !isProcessAvailable ||
    row.canProcess === false ||
    isProcessing
  const subtitleSubmenuDisabled = !(
    (row.path && !isDownloading && row.transcribeStatus === "running") ||
    (row.path && !isDownloading && isTranscribeAvailable && !isTranscribing) ||
    (row.path && !isDownloading && isTranslateAvailable && row.canTranslate && !isTranslating) ||
    (row.path && !isDownloading && row.translateStatus === "running") ||
    (row.path && !isDownloading && isSynthesizeAvailable && row.canSynthesize && !isSynthesizing) ||
    (row.path && !isDownloading && row.synthesizeStatus === "running") ||
    (row.path && !isDownloading && row.processStatus === "running") ||
    (row.path && !isDownloading && isProcessAvailable && row.canProcess !== false && !isProcessing)
  )

  /** Subtitle / pipeline task shown in index column (same slot as download status). */
  const subtitleIndexColumn =
    !row.jobId &&
    (isProcessing
      ? ("process-run" as const)
      : isSynthesizing
        ? ("synthesize-run" as const)
        : isTranslating
          ? ("translate-run" as const)
          : isTranscribing
            ? ("transcribe-run" as const)
            : row.processStatus === "failed" && !isProcessing
              ? ("subtitle-failed" as const)
              : row.synthesizeStatus === "failed" && !isSynthesizing
                ? ("subtitle-failed" as const)
                : row.translateStatus === "failed" && !isTranslating
                  ? ("subtitle-failed" as const)
                  : row.transcribeStatus === "failed" && !isTranscribing
                    ? ("subtitle-failed" as const)
                    : null)

  const indexColumnRunningTooltip: string | undefined =
    row.jobId && row.status === "downloading"
      ? t("mediaPlayer.downloadingTooltip")
      : subtitleIndexColumn === "transcribe-run"
        ? t("mediaPlayer.transcribingTooltip")
        : subtitleIndexColumn === "translate-run"
          ? t("mediaPlayer.translateRunningTooltip")
          : subtitleIndexColumn === "synthesize-run"
            ? t("mediaPlayer.synthesizeRunningTooltip")
            : subtitleIndexColumn === "process-run"
              ? t("mediaPlayer.processRunningTooltip")
              : undefined

  const indexColumnShowsRunningSpinner = indexColumnRunningTooltip !== undefined

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
              return
            }
            if (isSelected) return
            onTrackClick?.(row.id)
          }}
        >
          <TableCell className="w-10 px-2 py-1.5 text-center">
            <div className="flex items-center justify-center">
              {indexColumnShowsRunningSpinner ? (
                <span
                  className="inline-flex cursor-default"
                  title={indexColumnRunningTooltip}
                  aria-label={indexColumnRunningTooltip}
                >
                  <Spinner className="size-4 text-primary" />
                </span>
              ) : row.jobId ? (
                row.status === "completed" ? (
                  <CheckCircle2 className="size-4 text-green-500" />
                ) : row.status === "failed" ? (
                  <XCircle className="size-4 text-red-500" />
                ) : row.status === "stopped" ? (
                  <CircleStop className="size-4 text-orange-500" />
                ) : (
                  <Clock className="size-4 text-muted-foreground" />
                )
              ) : subtitleIndexColumn === "subtitle-failed" ? (
                <XCircle className="size-4 text-red-500" aria-hidden />
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
                <span className="text-muted-foreground">{row.index + 1}</span>
              )}
            </div>
          </TableCell>

          <TableCell className="w-16 px-0 py-1.5">
            {row.thumbnail ? (
              <HoverCard openDelay={200} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <div className="mx-auto h-8 w-14 cursor-default overflow-hidden rounded">
                    <Image
                      url={getThumbnailImageUrl(row.thumbnail, mediaFolderPath)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                </HoverCardTrigger>
                <HoverCardContent
                  side="right"
                  align="center"
                  className="w-auto max-w-[240px] p-1"
                >
                  <ThumbnailPreview
                    thumbnailPath={row.thumbnail}
                    mediaFolderPath={mediaFolderPath}
                  />
                </HoverCardContent>
              </HoverCard>
            ) : (
              <div className="mx-auto flex h-8 w-14 items-center justify-center rounded bg-muted">
                <Music className="size-3 text-muted-foreground/50" />
              </div>
            )}
          </TableCell>

          <TableCell className="min-w-0 px-2 py-1.5">
            <p
              className={`min-w-0 truncate ${isSelected ? "font-medium text-primary" : ""}`}
              title={
                isProcessing
                  ? t("mediaPlayer.processRunningTooltip")
                  : row.processStatus === "failed" && !isProcessing
                    ? t("mediaPlayer.processFailedTooltip")
                    : isTranslating
                      ? t("mediaPlayer.translateRunningTooltip")
                      : row.translateStatus === "failed" && !isTranslating
                        ? t("mediaPlayer.translateFailedTooltip")
                        : isSynthesizing
                          ? t("mediaPlayer.synthesizeRunningTooltip")
                          : row.synthesizeStatus === "failed" && !isSynthesizing
                            ? t("mediaPlayer.synthesizeFailedTooltip")
                            : isTranscribing
                              ? t("mediaPlayer.transcribingTooltip")
                              : row.transcribeStatus === "failed"
                                ? t("mediaPlayer.transcribeFailedTooltip")
                                : row.title
              }
            >
              <span className="truncate">{row.title}</span>
            </p>
          </TableCell>

          <TableCell className="w-32 px-2 py-1.5">
            <p className="truncate text-muted-foreground" title={row.artist}>
              {row.artist || "-"}
            </p>
          </TableCell>

          <TableCell className="w-16 px-2 py-1.5 text-right text-muted-foreground">
            {isDownloading ? "..." : formatDuration(row.duration)}
          </TableCell>
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {row.jobId && row.status !== "downloading" && row.status !== "completed" && (
          <ContextMenuItem
            disabled={hasRunningDownload}
            onClick={() => onDownloadStart?.(row.jobId!)}
          >
            <CirclePlay className="mr-2 size-4" />
            {t("mediaPlayer.trackContextMenu.downloadStart")}
          </ContextMenuItem>
        )}
        {row.jobId && row.status === "downloading" && (
          <ContextMenuItem onClick={() => onDownloadStop?.(row.jobId!)}>
            <CircleStop className="mr-2 size-4" />
            {t("mediaPlayer.trackContextMenu.downloadStop")}
          </ContextMenuItem>
        )}
        {row.jobId && (
          <ContextMenuItem
            variant="destructive"
            onClick={() => onDownloadRemove?.(row.jobId!)}
          >
            <CircleX className="mr-2 size-4" />
            {t("mediaPlayer.trackContextMenu.downloadRemove")}
          </ContextMenuItem>
        )}
        <ContextMenuItem
          disabled={!row.path || isDownloading}
          onClick={() => onTrackOpen?.(row)}
        >
          <FolderOpen className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.open")}
        </ContextMenuItem>
        <ContextMenuItem
          disabled={isDownloading}
          onClick={() => onTrackProperties?.(row)}
        >
          <FileText className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.properties")}
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!row.path || isDownloading}
          onClick={() => onTrackEditTags?.(row)}
        >
          <Tag className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.editTags")}
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!row.path || isDownloading}
          onClick={() => onTrackFormatConvert?.(row)}
        >
          <FileText className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.formatConvert")}
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger
            disabled={subtitleSubmenuDisabled}
            className="flex items-center"
          >
            <Captions className="mr-2 size-4" />
            {t("mediaPlayer.trackContextMenu.subtitle")}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {row.transcribeStatus === "running" && (
              <ContextMenuItem
                disabled={!row.path || isDownloading}
                onClick={() => onTranscribeStop?.(row)}
              >
                <CircleStop className="mr-2 size-4" />
                {t("mediaPlayer.trackContextMenu.transcribeStop")}
              </ContextMenuItem>
            )}
            <ContextMenuItem
              disabled={transcribeItemDisabled}
              onClick={() => onTrackTranscribe?.(row)}
            >
              <Captions className="mr-2 size-4" />
              {t("mediaPlayer.trackContextMenu.transcribe")}
            </ContextMenuItem>
            {row.translateStatus === "running" && (
              <ContextMenuItem
                disabled={!row.path || isDownloading}
                onClick={() => onTranslateStop?.(row)}
              >
                <CircleStop className="mr-2 size-4" />
                {t("mediaPlayer.trackContextMenu.translateStop")}
              </ContextMenuItem>
            )}
            <ContextMenuItem
              disabled={translateDisabled}
              onClick={() => onTrackTranslate?.(row)}
            >
              <Languages className="mr-2 size-4" />
              {t("mediaPlayer.trackContextMenu.translate")}
            </ContextMenuItem>
            {row.synthesizeStatus === "running" && (
              <ContextMenuItem
                disabled={!row.path || isDownloading}
                onClick={() => onSynthesizeStop?.(row)}
              >
                <CircleStop className="mr-2 size-4" />
                {t("mediaPlayer.trackContextMenu.synthesizeStop")}
              </ContextMenuItem>
            )}
            <ContextMenuItem
              disabled={synthesizeDisabled}
              onClick={() => onTrackSynthesize?.(row)}
            >
              <FileVideo className="mr-2 size-4" />
              {t("mediaPlayer.trackContextMenu.synthesize")}
            </ContextMenuItem>
            {row.processStatus === "running" && (
              <ContextMenuItem
                disabled={!row.path || isDownloading}
                onClick={() => onProcessStop?.(row)}
              >
                <CircleStop className="mr-2 size-4" />
                {t("mediaPlayer.trackContextMenu.processStop")}
              </ContextMenuItem>
            )}
            <ContextMenuItem
              disabled={processItemDisabled}
              onClick={() => onTrackProcess?.(row)}
            >
              <Sparkles className="mr-2 size-4" />
              {t("mediaPlayer.trackContextMenu.process")}
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem
          variant="destructive"
          disabled={!row.path || isDownloading}
          onClick={() => onTrackDelete?.(row)}
        >
          <Trash2 className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.delete")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
