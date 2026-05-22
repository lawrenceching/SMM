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
import type { RowSubtitleUi } from "@/hooks/useMusicFolderSubtitlePipeline"
import { MusicRowMediaCells } from "./musicTableRowShared"

export interface MusicTableSelection {
  isMultiSelectMode: boolean
  selectedTrackIds: number[]
  onSelectedTrackIdsChange?: (ids: number[]) => void
}

export interface LocalFileTableRowFileMenu {
  onOpen: () => void
  onDelete: () => void
  onProperties: () => void
  onFormatConvert: () => void
  onEditTags: () => void
}

export interface LocalFileTableRowSubtitleActions {
  onTranscribe: () => void
  onTranscribeStop: () => void
  onTranslate: () => void
  onTranslateStop: () => void
  onSynthesize: () => void
  onSynthesizeStop: () => void
  onProcess: () => void
  onProcessStop: () => void
}

export interface UILocalFileTableRowProps {
  row: LocalFileTableRowData
  mediaFolderPath?: string
  isSelected: boolean
  selection: MusicTableSelection
  subtitleUi: RowSubtitleUi
  subtitleActions: LocalFileTableRowSubtitleActions
  fileMenu: LocalFileTableRowFileMenu
  onTrackClick?: (trackId: number) => void
}

export function UILocalFileTableRow({
  row,
  mediaFolderPath,
  isSelected,
  selection,
  subtitleUi,
  subtitleActions,
  fileMenu,
  onTrackClick,
}: UILocalFileTableRowProps) {
  const { t } = useTranslation(["components"])
  const { isMultiSelectMode, selectedTrackIds, onSelectedTrackIdsChange } = selection

  const toggleTrackSelection = (trackId: number) => {
    const next = selectedTrackIds.includes(trackId)
      ? selectedTrackIds.filter((id) => id !== trackId)
      : [...selectedTrackIds, trackId]
    onSelectedTrackIdsChange?.(next)
  }

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
              {subtitleUi.indexColumnVariant === "spinner" ? (
                <span
                  className="inline-flex cursor-default"
                  title={subtitleUi.indexColumnTooltip}
                  aria-label={subtitleUi.indexColumnTooltip}
                >
                  <Spinner className="size-4 text-primary" />
                </span>
              ) : subtitleUi.indexColumnVariant === "failed" ? (
                <XCircle className="size-4 text-red-500" aria-hidden />
              ) : subtitleUi.indexColumnVariant === "checkbox" ? (
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
            titleTooltip={subtitleUi.titleTooltip}
          />
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={fileMenu.onOpen}>
          <FolderOpen className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.open")}
        </ContextMenuItem>
        <ContextMenuItem onClick={fileMenu.onProperties}>
          <FileText className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.properties")}
        </ContextMenuItem>
        <ContextMenuItem onClick={fileMenu.onEditTags}>
          <Tag className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.editTags")}
        </ContextMenuItem>
        <ContextMenuItem onClick={fileMenu.onFormatConvert}>
          <FileText className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.formatConvert")}
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger
            disabled={subtitleUi.submenuDisabled}
            className="flex items-center"
          >
            <Captions className="mr-2 size-4" />
            {t("mediaPlayer.trackContextMenu.subtitle")}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {subtitleUi.transcribeStatus === "running" && (
              <ContextMenuItem onClick={subtitleActions.onTranscribeStop}>
                <CircleStop className="mr-2 size-4" />
                {t("mediaPlayer.trackContextMenu.transcribeStop")}
              </ContextMenuItem>
            )}
            <ContextMenuItem
              disabled={subtitleUi.transcribeStartDisabled}
              onClick={subtitleActions.onTranscribe}
            >
              <Captions className="mr-2 size-4" />
              {t("mediaPlayer.trackContextMenu.transcribe")}
            </ContextMenuItem>
            {subtitleUi.translateStatus === "running" && (
              <ContextMenuItem onClick={subtitleActions.onTranslateStop}>
                <CircleStop className="mr-2 size-4" />
                {t("mediaPlayer.trackContextMenu.translateStop")}
              </ContextMenuItem>
            )}
            <ContextMenuItem
              disabled={subtitleUi.translateStartDisabled}
              onClick={subtitleActions.onTranslate}
            >
              <Languages className="mr-2 size-4" />
              {t("mediaPlayer.trackContextMenu.translate")}
            </ContextMenuItem>
            {subtitleUi.synthesizeStatus === "running" && (
              <ContextMenuItem onClick={subtitleActions.onSynthesizeStop}>
                <CircleStop className="mr-2 size-4" />
                {t("mediaPlayer.trackContextMenu.synthesizeStop")}
              </ContextMenuItem>
            )}
            <ContextMenuItem
              disabled={subtitleUi.synthesizeStartDisabled}
              onClick={subtitleActions.onSynthesize}
            >
              <FileVideo className="mr-2 size-4" />
              {t("mediaPlayer.trackContextMenu.synthesize")}
            </ContextMenuItem>
            {subtitleUi.processStatus === "running" && (
              <ContextMenuItem onClick={subtitleActions.onProcessStop}>
                <CircleStop className="mr-2 size-4" />
                {t("mediaPlayer.trackContextMenu.processStop")}
              </ContextMenuItem>
            )}
            <ContextMenuItem
              disabled={subtitleUi.processStartDisabled}
              onClick={subtitleActions.onProcess}
            >
              <Sparkles className="mr-2 size-4" />
              {t("mediaPlayer.trackContextMenu.process")}
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem variant="destructive" onClick={fileMenu.onDelete}>
          <Trash2 className="mr-2 size-4" />
          {t("mediaPlayer.trackContextMenu.delete")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
