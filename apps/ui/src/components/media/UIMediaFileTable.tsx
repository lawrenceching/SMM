import type { MetadataFiles } from "@smm/types/MetadataFiles"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronRightIcon } from "lucide-react"
import {
  cloneElement,
  isValidElement,
  useCallback,
  useState,
  useMemo,
  type ReactElement,
  type ReactNode,
} from "react"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import {
  MediaFileTableTr,
  MediaFileTableRowsBody,
  MediaFileTableSectionRows,
  type MediaFileTableBodyRow,
  type MediaFileTableColumnKey,
  type MediaFileTableRowContext,
  EpisodeContextMenu,
  type EpisodeContextMenuItem,
  MediaFileTableEpisodeSimpleRow,
  MediaFileTableEpisodeDetailRow,
  MediaFileTableEpisodePreviewRow,
  MediaFileTableNameValueRow,
} from "./MediaFileTableRow"
import {
  buildMediaFileTableColumnLayout,
  MediaFileTableColGroup,
} from "./mediaFileTableColumns"
import { rel } from "@/lib/path";

// ========================================================================
// Row types
// ========================================================================

/** A collapsible section heading (e.g. "Season 1", "Movie"). */
export interface UIMediaFileDividerRow {
  id: string
  type: "divider"
  text: string
}

/**
 * Identifies one TV episode row for checkbox selection.
 *
 * Selection is kept separate from the row data (controlled by the table via
 * the `selectedEpisodes` prop, or managed internally), so user toggles survive
 * row rebuilds that derive from refetched metadata / plans.
 */
export interface UIMediaEpisodeSelection {
  season: number
  episode: number
}

/**
 * @deprecated
 * A single playable file row (e.g. one TV episode or one movie).
 *
 * `season` and `episode` are kept on every data row for layout compatibility
 * with TV shows. MoviePanel sets them to `1` for its single virtual episode.
 */
export interface UIMediaFileDataRow {
  season: number
  episode: number
  type: "episode"
  videoFile: string | undefined
  thumbnail: string | undefined
  subtitle: string | undefined
  nfo: string | undefined
  /** Episode title from TMDB (for detail layout). */
  episodeTitle?: string
  /** Preview target paths (used when preview mode is active) */
  newVideoFile?: string
  newThumbnail?: string
  newSubtitle?: string
  newNfo?: string
  /**
   * In preview mode, row does not participate in the current plan:
   * checkbox is disabled and the row is rendered in a muted style.
   * Read-only fields like `videoFile` remain populated.
   */
  disabled?: boolean
}

export type FolderFileId = "clearlogo" | "fanart" | "poster" | "theme" | "nfo"

/** A folder-level asset (poster, fanart, nfo, etc.) — not playable. */
export interface UIMediaFileFolderRow {
  id: FolderFileId
  type: "folderFile"
  path: string
}


export interface MediaFileTableEpisodeData {
  season: number,
  episode: number,
  title: string,
  path?: string,
}

export interface MediaFileTableSeasonData {
  season: number,
  title: string,
  episodes: MediaFileTableEpisodeData[],
}

export type UIMediaFileTableRow = UIMediaFileDividerRow | UIMediaFileDataRow | UIMediaFileFolderRow

// ========================================================================
// Context menu types
// ========================================================================

/** A single context menu item for data rows (type === "episode"). */
export interface UIMediaFileDataContextMenuItem {
  /** Unique id. */
  id: string
  /** Display label (already translated). */
  label: string
  /** Called on click. Falsy → the item is hidden. */
  onClick?: (row: UIMediaFileDataRow) => void
  /** Disabled state. Function form receives the row for per-row logic. */
  disabled?: boolean | ((row: UIMediaFileDataRow) => boolean)
}

/** A single context menu item for folder file rows (type === "folderFile"). */
export interface UIMediaFileFolderContextMenuItem {
  id: string
  label: string
  onClick?: (row: UIMediaFileFolderRow) => void
  disabled?: boolean | ((row: UIMediaFileFolderRow) => boolean)
}

/** Configuration for context menus on UIMediaFileTable rows. */
export interface UIMediaFileTableContextMenuConfig {
  /** Items rendered on the data row's right-click menu. */
  dataRowItems?: UIMediaFileDataContextMenuItem[]
  /** Items rendered on the folder file row's right-click menu. */
  folderFileRowItems?: UIMediaFileFolderContextMenuItem[]
}

// ========================================================================
// Component props
// ========================================================================

export interface UIMediaFileTableProps {
  seasonData?: MediaFileTableSeasonData[],
  metadataFiles?: MetadataFiles,
  data: UIMediaFileTableRow[]
  /** When set, paths are shown relative to this base. */
  mediaFolderPath?: string
  /** Right-click menu configuration. Omit for no row context menus. */
  contextMenuConfig?: UIMediaFileTableContextMenuConfig
  /**
   * NOTE: `preview` mode is a different concept from `preview` layout.
   * - `preview` mode: preview a recognition or rename plan (shows old→new paths, etc.)
   * - `preview` layout: a layout option that displays video screenshots.
   */
  preview?: "rename" | "recognize"
  previewStatus?: "loading" | "ok"
  /**
   * Table layout:
   * - `simple`   compact row, columns hidden via header right-click
   * - `detail`   cover thumbnail + episode title + path
   * - `preview`  no ID column, larger cover, extra content area for video screenshots
   */
  layout?: "simple" | "detail" | "preview"
  /**
   * Controlled checkbox selection — which episodes are currently checked.
   * Omit → the table manages the selection internally (uncontrolled mode).
   * Checkboxes are only rendered while `preview` is set.
   */
  selectedEpisodes?: UIMediaEpisodeSelection[]
  /** Checkbox state callback. Omit → checkbox column is hidden. */
  onCheck?: (row: UIMediaFileDataRow, checked: boolean) => void
  /**
   * Renders the extra content area below the video path in `preview` layout
   * (e.g. video screenshots). Omit → the area is hidden.
   */
  renderPreviewContent?: (row: UIMediaFileDataRow) => ReactNode

  /**
   * Double-click handler for data rows and folder file rows.
   * Divider rows are not interactive and do not trigger this callback.
   * Omit → double-click has no effect.
   */
  onDoubleClick?: (row: UIMediaFileDataRow | UIMediaFileFolderRow) => void
}

// ========================================================================
// Column visibility
// ========================================================================

type ColumnKey = MediaFileTableColumnKey

const getColumnLabels = (
  t: (key: string, options?: Record<string, unknown>) => string,
): Record<ColumnKey, string> => ({
  video: t("mediaFileTable.columns.video"),
  thumbnail: t("mediaFileTable.columns.thumbnail"),
  subtitle: t("mediaFileTable.columns.subtitle"),
  nfo: t("mediaFileTable.columns.nfo"),
})

const defaultColumnVisibility: Record<ColumnKey, boolean> = {
  video: true,
  thumbnail: true,
  subtitle: true,
  nfo: true,
}

// ========================================================================
// Table segmentation (divider sections)
// ========================================================================

type TableSegment =
  | { kind: "standalone"; row: UIMediaFileTableRow; index: number }
  | {
      kind: "section"
      divider: UIMediaFileDividerRow
      dividerIndex: number
      rows: Array<{ row: UIMediaFileTableRow; index: number }>
    }

function groupTableData(data: UIMediaFileTableRow[]): TableSegment[] {
  const segments: TableSegment[] = []
  let index = 0

  while (index < data.length) {
    const row = data[index]
    if (row.type === "divider") {
      const divider = row
      const dividerIndex = index
      index += 1
      const rows: Array<{ row: UIMediaFileTableRow; index: number }> = []
      while (index < data.length && data[index].type !== "divider") {
        rows.push({ row: data[index], index })
        index += 1
      }
      segments.push({ kind: "section", divider, dividerIndex, rows })
    } else {
      segments.push({ kind: "standalone", row, index })
      index += 1
    }
  }

  return segments
}

const collapsibleSectionContentClassName = cn(
  "media-file-table-section-content overflow-hidden",
  "data-[state=closed]:animate-[media-file-table-collapsible-up_200ms_ease-out]",
  "data-[state=open]:animate-[media-file-table-collapsible-down_200ms_ease-out]",
)

type TableRenderBlock =
  | { kind: "rows"; key: string; rows: MediaFileTableBodyRow[] }
  | {
      kind: "section"
      divider: UIMediaFileDividerRow
      dividerIndex: number
      rows: MediaFileTableBodyRow[]
    }

function toBodyRow(
  row: UIMediaFileTableRow,
  index: number,
): MediaFileTableBodyRow | null {
  if (row.type === "folderFile") return { row, index }
  if (row.type === "episode") return { row, index }
  return null
}

/** Merge consecutive standalone rows into one tbody so row borders render correctly. */
function groupSegmentsForRender(segments: TableSegment[]): TableRenderBlock[] {
  const blocks: TableRenderBlock[] = []
  let standaloneBatch: MediaFileTableBodyRow[] = []

  const flushStandalone = () => {
    if (standaloneBatch.length === 0) return
    blocks.push({
      kind: "rows",
      key: `standalone-${standaloneBatch[0].index}`,
      rows: standaloneBatch,
    })
    standaloneBatch = []
  }

  for (const segment of segments) {
    if (segment.kind === "standalone") {
      const bodyRow = toBodyRow(segment.row, segment.index)
      if (bodyRow) standaloneBatch.push(bodyRow)
      continue
    }

    flushStandalone()

    const sectionRows = segment.rows
      .map(({ row, index }) => toBodyRow(row, index))
      .filter((row): row is MediaFileTableBodyRow => row !== null)

    blocks.push({
      kind: "section",
      divider: segment.divider,
      dividerIndex: segment.dividerIndex,
      rows: sectionRows,
    })
  }

  flushStandalone()
  return blocks
}

// ========================================================================
// Main component
// ========================================================================



export function UIMediaFileTable({
  data,
  metadataFiles,
  seasonData = [],
  mediaFolderPath,
  contextMenuConfig,
  preview,
  previewStatus,
  layout = "simple",
  selectedEpisodes,
  onCheck,
  renderPreviewContent,
  onDoubleClick,
}: UIMediaFileTableProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>(
    defaultColumnVisibility,
  )
  const [internalSelectedEpisodes, setInternalSelectedEpisodes] = useState<
    UIMediaEpisodeSelection[]
  >([])

  // Controlled when the caller provides `selectedEpisodes`; otherwise the table
  // keeps the selection in internal state (uncontrolled mode).
  const isSelectionControlled = selectedEpisodes !== undefined
  const effectiveSelection = selectedEpisodes ?? internalSelectedEpisodes
  const selectedEpisodeKeys = useMemo(
    () => new Set(effectiveSelection.map((e) => `${e.season}-${e.episode}`)),
    [effectiveSelection],
  )

  const isEpisodeSelected = useCallback(
    (row: UIMediaFileDataRow) => selectedEpisodeKeys.has(`${row.season}-${row.episode}`),
    [selectedEpisodeKeys],
  )

  const handleRowCheck = useCallback(
    (row: UIMediaFileDataRow, checked: boolean) => {
      if (!isSelectionControlled) {
        setInternalSelectedEpisodes((prev) => {
          const exists = prev.some(
            (e) => e.season === row.season && e.episode === row.episode,
          )
          if (checked === exists) return prev
          if (checked) return [...prev, { season: row.season, episode: row.episode }]
          return prev.filter(
            (e) => !(e.season === row.season && e.episode === row.episode),
          )
        })
      }
      onCheck?.(row, checked)
    },
    [isSelectionControlled, onCheck],
  )

  const { t } = useTranslation("components")

  const isSimpleLayout = layout === "simple"
  const isPreviewLayout = layout === "preview"
  const showThumbnailColumn =
    (!isSimpleLayout && layout === "detail") || isPreviewLayout || columnVisibility.thumbnail
  const showIdColumn = layout !== "preview"
  const showCheckboxColumn = preview !== undefined
  const visibleColumnCount =
    (showCheckboxColumn ? 1 : 0) +
    (showIdColumn ? 1 : 0) +
    (showThumbnailColumn ? 1 : 0) +
    (columnVisibility.video ? 1 : 0) +
    (columnVisibility.subtitle ? 1 : 0) +
    (columnVisibility.nfo ? 1 : 0)

  const thumbnailCellWidth = isPreviewLayout
    ? "w-[160px] min-w-[160px]"
    : layout === "detail"
      ? "w-[100px] min-w-[100px]"
      : ""

  const segments = useMemo(() => groupTableData(data), [data])
  const renderBlocks = useMemo(() => groupSegmentsForRender(segments), [segments])
  const columnLayout = useMemo(
    () =>
      buildMediaFileTableColumnLayout({
        layout,
        preview,
        columnVisibility,
      }),
    [layout, preview, columnVisibility],
  )

  const setSectionCollapsed = (dividerId: string, collapsed: boolean) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (collapsed) next.add(dividerId)
      else next.delete(dividerId)
      return next
    })
  }

  const toggleColumn = (key: ColumnKey) => {
    setColumnVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const columnLabels = getColumnLabels(
    t as (key: string, options?: Record<string, unknown>) => string,
  )

  const renderContext: MediaFileTableRowContext = {
    mediaFolderPath,
    contextMenuConfig,
    preview,
    previewStatus,
    layout,
    onCheck: handleRowCheck,
    isSelected: isEpisodeSelected,
    renderPreviewContent,
    onDoubleClick,
    isSimpleLayout,
    isPreviewLayout,
    showThumbnailColumn,
    showIdColumn,
    showCheckboxColumn,
    columnVisibility,
    columnLayout,
    t: t as (key: string, options?: Record<string, unknown>) => string,
  }

  // Context menu items for the seasonData-driven episode rows. Built once per
  // config from the (deprecated) UIMediaFileDataRow-based `dataRowItems`.
  const episodeContextMenuItems = useMemo(
    () => buildEpisodeContextMenuItems(contextMenuConfig),
    [contextMenuConfig],
  )

  // ── Render: header row with column-visibility context menu ────────────
  const headerRow = (
    <MediaFileTableTr className="hover:bg-transparent">
      {showCheckboxColumn && (
        <TableCell
          className="h-8 w-10 shrink-0 px-0 py-1 text-center"
          title={t("mediaFileTable.renameCheckboxTitle", {
            defaultValue: "Include in rename",
          })}
        />
      )}
      {showIdColumn && (
        <TableHead className="h-8 w-[100px] px-2 py-1">
          {t("mediaFileTable.columns.id")}
        </TableHead>
      )}
      {isSimpleLayout ? (
        <>
          {columnVisibility.video && (
            <TableHead className="h-8 min-w-0 px-2 py-1">
              {t("mediaFileTable.header.videoFile")}
            </TableHead>
          )}
          {showThumbnailColumn && (
            <TableHead
              className="h-8 w-10 shrink-0 px-0 py-1 text-center whitespace-nowrap"
              title={t("mediaFileTable.columns.thumbnail")}
            >
              {t("mediaFileTable.header.thumb")}
            </TableHead>
          )}
        </>
      ) : (
        <>
          {showThumbnailColumn && (
            <TableHead
              className={cn(
                "h-8 px-1 py-1",
                thumbnailCellWidth || "w-10 shrink-0 px-0 text-center whitespace-nowrap",
              )}
              title={t("mediaFileTable.columns.thumbnail")}
            >
              {t("mediaFileTable.header.thumb")}
            </TableHead>
          )}
          {columnVisibility.video && (
            <TableHead className="h-8 min-w-0 px-2 py-1">
              {t("mediaFileTable.header.videoFile")}
            </TableHead>
          )}
        </>
      )}
      {columnVisibility.subtitle && (
        <TableHead
          className="h-8 w-10 shrink-0 px-0 py-1 text-center whitespace-nowrap"
          title={t("mediaFileTable.columns.subtitle")}
        >
          {t("mediaFileTable.header.sub")}
        </TableHead>
      )}
      {columnVisibility.nfo && (
        <TableHead
          className="h-8 w-10 shrink-0 px-0 py-1 text-center whitespace-nowrap"
          title={t("mediaFileTable.columns.nfo")}
        >
          {t("mediaFileTable.header.nfo")}
        </TableHead>
      )}
    </MediaFileTableTr>
  )



  return (
    <section data-testid="media-file-table" className="bg-card">
      <Table className="text-xs table-fixed w-full">
        <MediaFileTableColGroup layout={columnLayout} />
        <TableHeader>
          <ContextMenu>
            <ContextMenuTrigger asChild>{headerRow}</ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  {t("mediaFileTable.contextMenu.showColumns")}
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuCheckboxItem
                    checked={columnVisibility.video}
                    onCheckedChange={() => toggleColumn("video")}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {columnLabels.video}
                  </ContextMenuCheckboxItem>
                  <ContextMenuCheckboxItem
                    checked={columnVisibility.thumbnail}
                    onCheckedChange={() => toggleColumn("thumbnail")}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {columnLabels.thumbnail}
                  </ContextMenuCheckboxItem>
                  <ContextMenuCheckboxItem
                    checked={columnVisibility.subtitle}
                    onCheckedChange={() => toggleColumn("subtitle")}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {columnLabels.subtitle}
                  </ContextMenuCheckboxItem>
                  <ContextMenuCheckboxItem
                    checked={columnVisibility.nfo}
                    onCheckedChange={() => toggleColumn("nfo")}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {columnLabels.nfo}
                  </ContextMenuCheckboxItem>
                </ContextMenuSubContent>
              </ContextMenuSub>
            </ContextMenuContent>
          </ContextMenu>
        </TableHeader>

        <MediaFileTableNameValueRow name='poster' value={rel(mediaFolderPath, metadataFiles?.posterPath)} hoverTitle={metadataFiles?.posterPath} />
        <MediaFileTableNameValueRow name='fanart' value={rel(mediaFolderPath, metadataFiles?.fanartPath)} hoverTitle={metadataFiles?.fanartPath} />
        <MediaFileTableNameValueRow name='nfo' value={rel(mediaFolderPath, metadataFiles?.nfoPath)} hoverTitle={metadataFiles?.nfoPath} />
        <MediaFileTableNameValueRow name='clearlogo' value={rel(mediaFolderPath, metadataFiles?.clearlogoPath)} hoverTitle={metadataFiles?.clearlogoPath} />
        <MediaFileTableNameValueRow name='theme' value={rel(mediaFolderPath, metadataFiles?.themePath)} hoverTitle={metadataFiles?.themePath} />

        {/* New path, will be the default in the future */}
        {
          layout === "simple" && seasonData.map((season) => {
            const collapsibleId = `season-${season.season}`
            const isCollapsed = collapsedIds.has(collapsibleId)
            return (
              <UIMediaFileTableSeasonBlock
                key={collapsibleId}
                season={season}
                items={episodeContextMenuItems}
                isCollapsed={isCollapsed}
                onOpenChange={(open) => setSectionCollapsed(collapsibleId, !open)}
                showCheckboxColumn={showCheckboxColumn}
                visibleColumnCount={visibleColumnCount}
              >
                <UIMediaFileTableEpisodeBlock season={season} mediaFolderPath={mediaFolderPath} />
              </UIMediaFileTableSeasonBlock>
            )
          })
        }

{
          layout === "detail" && seasonData.map((season) => {
            const collapsibleId = `season-${season.season}`
            const isCollapsed = collapsedIds.has(collapsibleId)
            return (
              <UIMediaFileTableSeasonBlock
                key={collapsibleId}
                season={season}
                items={episodeContextMenuItems}
                isCollapsed={isCollapsed}
                onOpenChange={(open) => setSectionCollapsed(collapsibleId, !open)}
                showCheckboxColumn={showCheckboxColumn}
                visibleColumnCount={visibleColumnCount}
              >
                <UIMediaFileTableEpisodeDetailBlock season={season} mediaFolderPath={mediaFolderPath} />
              </UIMediaFileTableSeasonBlock>
            )
          })
        }

        {
          layout === "preview" && seasonData.map((season) => {
            const collapsibleId = `season-${season.season}`
            const isCollapsed = collapsedIds.has(collapsibleId)
            return (
              <UIMediaFileTableSeasonBlock
                key={collapsibleId}
                season={season}
                items={episodeContextMenuItems}
                isCollapsed={isCollapsed}
                onOpenChange={(open) => setSectionCollapsed(collapsibleId, !open)}
                showCheckboxColumn={showCheckboxColumn}
                visibleColumnCount={visibleColumnCount}
              >
                <UIMediaFileTableEpisodePreviewBlock season={season} mediaFolderPath={mediaFolderPath} />
              </UIMediaFileTableSeasonBlock>
            )
          })
        }

        {/* Legacy path, will be removed in the future */}
        {renderBlocks.map((block, blockIndex) => {
          if (block.kind === "rows") {
            const nextBlock = renderBlocks[blockIndex + 1]
            const preserveLastRowBorder = nextBlock?.kind === "section"
            return (
              <MediaFileTableRowsBody
                key={block.key}
                ctx={renderContext}
                rows={block.rows}
                preserveLastRowBorder={preserveLastRowBorder}
              />
            )
          }

          const { divider, dividerIndex, rows } = block
          const isCollapsed = collapsedIds.has(divider.id)
          const expandLabel = t("mediaFileTable.expand")
          const collapseLabel = t("mediaFileTable.collapse")

          return (
            <Collapsible
              key={`${divider.id}-${dividerIndex}`}
              asChild
              open={!isCollapsed}
              onOpenChange={(open) => setSectionCollapsed(divider.id, !open)}
            >
              <TableBody className="group/section">
                <TableRow className="bg-muted/60 hover:bg-muted/70">
                  {showCheckboxColumn && <TableCell className="w-10 shrink-0 px-0 py-1" />}
                  <TableCell
                    colSpan={visibleColumnCount - (showCheckboxColumn ? 1 : 0)}
                    className="px-2 py-1.5 font-semibold"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{divider.text}</span>
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title={isCollapsed ? expandLabel : collapseLabel}
                          aria-label={isCollapsed ? expandLabel : collapseLabel}
                          aria-expanded={!isCollapsed}
                        >
                          <ChevronRightIcon className="size-4 transition-transform duration-200 group-data-[state=open]/section:rotate-90" />
                        </button>
                      </CollapsibleTrigger>
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow className="border-b-0 hover:bg-transparent">
                  <TableCell colSpan={visibleColumnCount} className="p-0 border-0 align-top">
                    <CollapsibleContent className={collapsibleSectionContentClassName}>
                      <MediaFileTableSectionRows
                        columnLayout={columnLayout}
                        ctx={renderContext}
                        rows={rows}
                      />
                    </CollapsibleContent>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Collapsible>
          )
        })}
      </Table>
    </section>
  )
}


/**
 * Collapsible season section for the `seasonData`-driven path: a header row
 * (season title + collapse toggle) above the season content.
 *
 * The season content is supplied as `children`, e.g.
 * `<UIMediaFileTableEpisodeBlock season={season} />`. When the child is an
 * `UIMediaFileTableEpisodeBlock`, this block's `items` are forwarded into it,
 * so the caller can compose the episode rows as children while the episode
 * menu items stay owned by the section.
 */
export function UIMediaFileTableSeasonBlock({
  season,
  items = [],
  isCollapsed,
  onOpenChange,
  showCheckboxColumn,
  visibleColumnCount,
  children,
}: {
  season: MediaFileTableSeasonData
  /** Right-click menu items for each episode row (forwarded to the episode block child). */
  items?: EpisodeContextMenuItem[]
  /** Whether the section is currently collapsed (controlled by the table). */
  isCollapsed: boolean
  /** Called with the new open state when the user toggles the section. */
  onOpenChange: (open: boolean) => void
  showCheckboxColumn: boolean
  visibleColumnCount: number
  /** Content rendered below the season header (e.g. `UIMediaFileTableEpisodeBlock`). */
  children?: ReactNode
}) {
  const { t } = useTranslation("components")
  const expandLabel = t("mediaFileTable.expand")
  const collapseLabel = t("mediaFileTable.collapse")

  // Compose the caller-supplied content. When it is one of the episode blocks
  // (simple/detail/preview), forward this section's `items` so the per-row
  // context menus keep working without the caller having to repeat the items
  // on the child.
  const content =
    isValidElement(children) &&
    (children.type === UIMediaFileTableEpisodeBlock ||
      children.type === UIMediaFileTableEpisodeDetailBlock ||
      children.type === UIMediaFileTableEpisodePreviewBlock)
      ? cloneElement(children as ReactElement<UIMediaFileTableEpisodeBlockProps>, {
          items,
        })
      : children

  return (
    <Collapsible asChild open={!isCollapsed} onOpenChange={onOpenChange}>
      <TableBody className="group/section">
        <TableRow className="bg-muted/60 hover:bg-muted/70">
          {showCheckboxColumn && <TableCell className="w-10 shrink-0 px-0 py-1" />}
          <TableCell
            colSpan={visibleColumnCount - (showCheckboxColumn ? 1 : 0)}
            className="px-2 py-1.5 font-semibold"
          >
            <div className="flex items-center justify-between gap-2">
              <span>{season.title}</span>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title={isCollapsed ? expandLabel : collapseLabel}
                  aria-label={isCollapsed ? expandLabel : collapseLabel}
                  aria-expanded={!isCollapsed}
                >
                  <ChevronRightIcon className="size-4 transition-transform duration-200 group-data-[state=open]/section:rotate-90" />
                </button>
              </CollapsibleTrigger>
            </div>
          </TableCell>
        </TableRow>
        <TableRow className="border-b-0 hover:bg-transparent">
          <TableCell colSpan={visibleColumnCount} className="p-0 border-0 align-top">
            <CollapsibleContent className={collapsibleSectionContentClassName}>
              {content}
            </CollapsibleContent>
          </TableCell>
        </TableRow>
      </TableBody>
    </Collapsible>
  )
}

/** Shared props of the season content blocks (`EpisodeBlock` / `EpisodeDetailBlock` /
 * `EpisodePreviewBlock`) rendered inside `UIMediaFileTableSeasonBlock`. */
export interface UIMediaFileTableEpisodeBlockProps {
  season: MediaFileTableSeasonData
  /** Right-click menu items for each episode row. */
  items?: EpisodeContextMenuItem[]
  /** When set, paths are shown relative to this base. */
  mediaFolderPath?: string
}

export function UIMediaFileTableEpisodeBlock({
  season,
  items = [],
  mediaFolderPath,
}: UIMediaFileTableEpisodeBlockProps) {
  return (
    <table className="w-full table-fixed text-xs">
      <TableBody>
        {season.episodes.map((episode) => (
          <EpisodeContextMenu
            key={`season-${season.season}-episode-${episode.episode}`}
            episode={episode}
            items={items}
          >
            <MediaFileTableEpisodeSimpleRow
              season={season.season}
              episode={episode.episode}
              title={episode.title}
              path={rel(mediaFolderPath, episode.path) || (episode.path ?? "")}
            />
          </EpisodeContextMenu>
        ))}
      </TableBody>
    </table>
  )
}

/**
 * `detail`-layout season content block: one `MediaFileTableEpisodeDetailRow`
 * per episode (id + cover thumbnail + title/path), each wrapped with its
 * right-click menu.
 */
export function UIMediaFileTableEpisodeDetailBlock({
  season,
  items = [],
  mediaFolderPath,
}: UIMediaFileTableEpisodeBlockProps) {
  return (
    <table className="w-full table-fixed text-xs">
      <TableBody>
        {season.episodes.map((episode) => (
          <EpisodeContextMenu
            key={`season-${season.season}-episode-${episode.episode}`}
            episode={episode}
            items={items}
          >
            <MediaFileTableEpisodeDetailRow
              season={season.season}
              episode={episode.episode}
              title={episode.title}
              path={rel(mediaFolderPath, episode.path) || (episode.path ?? "")}
            />
          </EpisodeContextMenu>
        ))}
      </TableBody>
    </table>
  )
}

/**
 * `preview`-layout season content block: one `MediaFileTableEpisodePreviewRow`
 * per episode (larger cover + id·title/path, no ID column), each wrapped with
 * its right-click menu.
 */
export function UIMediaFileTableEpisodePreviewBlock({
  season,
  items = [],
  mediaFolderPath,
}: UIMediaFileTableEpisodeBlockProps) {
  return (
    <table className="w-full table-fixed text-xs">
      <TableBody>
        {season.episodes.map((episode) => (
          <EpisodeContextMenu
            key={`season-${season.season}-episode-${episode.episode}`}
            episode={episode}
            items={items}
          >
            <MediaFileTableEpisodePreviewRow
              season={season.season}
              episode={episode.episode}
              title={episode.title}
              path={rel(mediaFolderPath, episode.path) || (episode.path ?? "")}
            />
          </EpisodeContextMenu>
        ))}
      </TableBody>
    </table>
  )
}

/**
 * Adapts the deprecated `UIMediaFileDataRow`-based episode menu items
 * (`UIMediaFileTableContextMenuConfig.dataRowItems`) to the new
 * `MediaFileTableEpisodeData` model, bridging each episode to a
 * `UIMediaFileDataRow` (`videoFile` → `path`) so the existing actions
 * (Open / Properties / panel extras) keep working on seasonData-driven rows.
 */
function buildEpisodeContextMenuItems(
  config: UIMediaFileTableContextMenuConfig | undefined,
): EpisodeContextMenuItem[] {
  const dataRowItems = config?.dataRowItems
  if (!dataRowItems) return []

  const toDataRow = (episode: MediaFileTableEpisodeData): UIMediaFileDataRow => ({
    season: episode.season,
    episode: episode.episode,
    type: "episode",
    videoFile: episode.path,
    thumbnail: undefined,
    subtitle: undefined,
    nfo: undefined,
    episodeTitle: episode.title,
  })

  return dataRowItems.map((item) => {
    const disabledRule = item.disabled
    return {
      id: item.id,
      label: item.label,
      onClick: item.onClick
        ? (episode: MediaFileTableEpisodeData) => item.onClick?.(toDataRow(episode))
        : undefined,
      disabled:
        typeof disabledRule === "function"
          ? (episode: MediaFileTableEpisodeData) => disabledRule(toDataRow(episode))
          : disabledRule,
    }
  })
}