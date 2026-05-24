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
  XCircle,
  Captions,
  ChevronRight,
  ChevronDown,
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { useTranslation } from "@/lib/i18n"
import type { LocalFileTableRowData } from "./MusicFileTable"
import type { RowSubtitleUi } from "@/hooks/useMusicFolderSubtitlePipeline"
import { MusicRowMediaCells } from "./musicTableRowShared"
import { SubtitleContextMenuItems } from "./SubtitleContextMenuItems"
import type {
  MusicTableSelection,
  LocalFileTableRowFileMenu,
  LocalFileTableRowSubtitleActions,
} from "@/types/music-table"

const subgridRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "subgrid",
  gridColumn: "1 / -1",
}

export interface LocalFileRowProps {
  row: LocalFileTableRowData
  mediaFolderPath?: string
  isSelected: boolean
  isExpanded: boolean
  selection: MusicTableSelection
  subtitleUi: RowSubtitleUi
  subtitleActions: LocalFileTableRowSubtitleActions
  fileMenu: LocalFileTableRowFileMenu
  onTrackClick?: (trackId: number) => void
  onToggleExpand: () => void
}

export function LocalFileRow({
  row,
  mediaFolderPath,
  isSelected,
  isExpanded,
  selection,
  subtitleUi,
  subtitleActions,
  fileMenu,
  onTrackClick,
  onToggleExpand,
}: LocalFileRowProps) {
  const { t } = useTranslation(["components"])
  const { isMultiSelectMode, selectedTrackIds, onSelectedTrackIdsChange } = selection

  const toggleTrackSelection = (trackId: number) => {
    const next = selectedTrackIds.includes(trackId)
      ? selectedTrackIds.filter((id) => id !== trackId)
      : [...selectedTrackIds, trackId]
    onSelectedTrackIdsChange?.(next)
  }

  const expandLabel = isExpanded
    ? t("localFileTableRow.collapse")
    : t("localFileTableRow.expand")

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          style={subgridRowStyle}
          role="row"
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
          <div
            role="cell"
            className="w-10 px-2 py-1.5 text-center flex items-center justify-center"
          >
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
          </div>

          <MusicRowMediaCells
            title={row.title}
            artist={row.artist}
            duration={row.duration}
            thumbnail={row.thumbnail}
            mediaFolderPath={mediaFolderPath}
            isSelected={isSelected}
            titleTooltip={subtitleUi.titleTooltip}
            as="div"
          />

          <div role="cell" className="flex items-center justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand()
              }}
              aria-label={expandLabel}
              className="p-1 rounded hover:bg-muted-foreground/10"
            >
              {isExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
          </div>
        </div>
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
            <SubtitleContextMenuItems
              subtitleUi={subtitleUi}
              subtitleActions={subtitleActions}
            />
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
