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
import {
  FolderOpen,
  Trash2,
  FileText,
  Tag,
  CircleStop,
  XCircle,
  Captions,
  Languages,
  FileVideo,
  Sparkles,
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { useTranslation } from "@/lib/i18n"
import type { LocalFileTableRowData } from "./MusicFileTable"
import { MusicRowMediaCells } from "./musicTableRowShared"

export type { LocalFileTableRowData } from "./MusicFileTable"

export interface LocalFileTableRowProps {
  row: LocalFileTableRowData
  mediaFolderPath?: string
  onTrackClick?: (trackId: number) => void
  isTranscribeAvailable?: boolean
  onTrackTranscribe?: (track: LocalFileTableRowData) => void
  onTranscribeStop?: (track: LocalFileTableRowData) => void
  isTranslateAvailable?: boolean
  onTrackTranslate?: (track: LocalFileTableRowData) => void
  onTranslateStop?: (track: LocalFileTableRowData) => void
  isSynthesizeAvailable?: boolean
  onTrackSynthesize?: (track: LocalFileTableRowData) => void
  onSynthesizeStop?: (track: LocalFileTableRowData) => void
  isProcessAvailable?: boolean
  onTrackProcess?: (track: LocalFileTableRowData) => void
  onProcessStop?: (track: LocalFileTableRowData) => void
  isMultiSelectMode?: boolean
  selectedTrackIds?: number[]
  onSelectedTrackIdsChange?: (ids: number[]) => void
  onTrackOpen?: (track: LocalFileTableRowData) => void
  onTrackDelete?: (track: LocalFileTableRowData) => void
  onTrackProperties?: (track: LocalFileTableRowData) => void
  onTrackFormatConvert?: (track: LocalFileTableRowData) => void
  onTrackEditTags?: (track: LocalFileTableRowData) => void
}

export function LocalFileTableRow({
  row,
  mediaFolderPath,
  onTrackClick,
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
}: LocalFileTableRowProps) {
  const { t } = useTranslation(["components"])

  const toggleTrackSelection = (trackId: number) => {
    const next = selectedTrackIds.includes(trackId)
      ? selectedTrackIds.filter((id) => id !== trackId)
      : [...selectedTrackIds, trackId]
    onSelectedTrackIdsChange?.(next)
  }

  const isSelected = selectedTrackIds.includes(row.id)
  const isTranscribing = row.transcribeStatus === "running"
  const isTranslating = row.translateStatus === "running"
  const isSynthesizing = row.synthesizeStatus === "running"
  const isProcessing = row.processStatus === "running"
  const translateDisabled =
    !isTranslateAvailable || !row.canTranslate || isTranslating
  const synthesizeDisabled =
    !isSynthesizeAvailable || !row.canSynthesize || isSynthesizing
  const transcribeItemDisabled = !isTranscribeAvailable || isTranscribing
  const processItemDisabled =
    !isProcessAvailable || row.canProcess === false || isProcessing
  const subtitleSubmenuDisabled = !(
    row.transcribeStatus === "running" ||
    (isTranscribeAvailable && !isTranscribing) ||
    (isTranslateAvailable && row.canTranslate && !isTranslating) ||
    row.translateStatus === "running" ||
    (isSynthesizeAvailable && row.canSynthesize && !isSynthesizing) ||
    row.synthesizeStatus === "running" ||
    row.processStatus === "running" ||
    (isProcessAvailable && row.canProcess !== false && !isProcessing)
  )

  const subtitleIndexColumn = isProcessing
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
                  : null

  const indexColumnRunningTooltip: string | undefined =
    subtitleIndexColumn === "transcribe-run"
      ? t("mediaPlayer.transcribingTooltip")
      : subtitleIndexColumn === "translate-run"
        ? t("mediaPlayer.translateRunningTooltip")
        : subtitleIndexColumn === "synthesize-run"
          ? t("mediaPlayer.synthesizeRunningTooltip")
          : subtitleIndexColumn === "process-run"
            ? t("mediaPlayer.processRunningTooltip")
            : undefined

  const titleTooltip = isProcessing
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

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow
          className={`cursor-pointer group ${isSelected ? "bg-muted" : ""}`}
          onClick={() => {
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
              {indexColumnRunningTooltip ? (
                <span
                  className="inline-flex cursor-default"
                  title={indexColumnRunningTooltip}
                  aria-label={indexColumnRunningTooltip}
                >
                  <Spinner className="size-4 text-primary" />
                </span>
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

          <MusicRowMediaCells
            title={row.title}
            artist={row.artist}
            duration={row.duration}
            thumbnail={row.thumbnail}
            mediaFolderPath={mediaFolderPath}
            isSelected={isSelected}
            titleTooltip={titleTooltip}
          />
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onTrackOpen?.(row)}>
          <FolderOpen className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.open")}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onTrackProperties?.(row)}>
          <FileText className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.properties")}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onTrackEditTags?.(row)}>
          <Tag className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.editTags")}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onTrackFormatConvert?.(row)}>
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
              <ContextMenuItem onClick={() => onTranscribeStop?.(row)}>
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
              <ContextMenuItem onClick={() => onTranslateStop?.(row)}>
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
              <ContextMenuItem onClick={() => onSynthesizeStop?.(row)}>
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
              <ContextMenuItem onClick={() => onProcessStop?.(row)}>
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
          onClick={() => onTrackDelete?.(row)}
        >
          <Trash2 className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.delete")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
