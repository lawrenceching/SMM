import { Spinner } from "@/components/ui/spinner"
import { isAbsPath, join, relative } from "@/lib/path"
import { Path } from "@core/path"
import { pathToFileURL } from "@core/url"
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
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, MinusIcon } from "lucide-react"
import Image from "@/components/Image"
import { useState, useMemo, type ReactNode } from "react"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

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
  checked: boolean
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
// Helpers (private)
// ========================================================================

function UICheckCell({ value }: { value: string | undefined }) {
  const checked = value !== undefined
  if (checked) {
    return (
      <div className="flex items-center justify-center">
        <CheckIcon className="size-3.5 text-emerald-600" />
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center">
      <MinusIcon className="size-3.5 text-muted-foreground" />
    </div>
  )
}

function getDisplayPath(fullPath: string, basePath: string | undefined): string {
  if (!basePath) return fullPath
  try {
    return relative(basePath, fullPath)
  } catch {
    return fullPath
  }
}

function getThumbnailImageUrl(thumbnailPath: string, mediaFolderPath: string | undefined): string {
  const absolutePath =
    mediaFolderPath && !isAbsPath(thumbnailPath)
      ? join(mediaFolderPath, thumbnailPath)
      : thumbnailPath
  const platformPath = Path.toPlatformPath(absolutePath)
  return pathToFileURL(platformPath)
}

function UIThumbnailImage({
  thumbnailPath,
  mediaFolderPath,
  className = "max-h-[240px] w-auto rounded object-contain",
}: {
  thumbnailPath: string
  mediaFolderPath: string | undefined
  className?: string
}) {
  const url = getThumbnailImageUrl(thumbnailPath, mediaFolderPath)
  return <Image url={url} alt="" className={className} />
}

// ========================================================================
// Column visibility
// ========================================================================

type ColumnKey = "video" | "thumbnail" | "subtitle" | "nfo"

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
// Disabled-resolver helper
// ========================================================================

function resolveDisabled<R extends UIMediaFileDataRow | UIMediaFileFolderRow>(
  rule: boolean | ((row: R) => boolean) | undefined,
  row: R,
): boolean {
  if (rule === undefined) return false
  if (typeof rule === "function") return rule(row)
  return rule
}

// ========================================================================
// Main component
// ========================================================================

export function UIMediaFileTable({
  data,
  mediaFolderPath,
  contextMenuConfig,
  preview,
  previewStatus,
  layout = "simple",
  onCheck,
  renderPreviewContent,
  onDoubleClick,
}: UIMediaFileTableProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>(
    defaultColumnVisibility,
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

  // Map each row index to the id of the most recent divider above it.
  // Used to hide rows that fall under a collapsed divider.
  const sectionIdByIndex = useMemo(() => {
    const map = new Map<number, string>()
    let currentId = ""
    data.forEach((row, index) => {
      if (row.type === "divider") {
        currentId = row.id
      }
      map.set(index, currentId)
    })
    return map
  }, [data])

  const toggleCollapsed = (dividerId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(dividerId)) next.delete(dividerId)
      else next.add(dividerId)
      return next
    })
  }

  const toggleColumn = (key: ColumnKey) => {
    setColumnVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const columnLabels = getColumnLabels(
    t as (key: string, options?: Record<string, unknown>) => string,
  )

  // ── Render: header row with column-visibility context menu ────────────
  const headerRow = (
    <TableRow className="hover:bg-transparent">
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
    </TableRow>
  )

  return (
    <section data-testid="media-file-table" className="bg-card">
      <Table className="text-xs table-fixed w-full">
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

        <TableBody>
          {data.map((row, index) => {
            // ── Divider row ──
            if (row.type === "divider") {
              const isCollapsed = collapsedIds.has(row.id)
              return (
                <TableRow
                  key={`${row.id}-${index}`}
                  className="bg-muted/60 hover:bg-muted/70"
                >
                  {showCheckboxColumn && <TableCell className="w-10 shrink-0 px-0 py-1" />}
                  <TableCell
                    colSpan={visibleColumnCount - (showCheckboxColumn ? 1 : 0)}
                    className="px-2 py-1.5 font-semibold"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{row.text}</span>
                      <button
                        type="button"
                        onClick={() => toggleCollapsed(row.id)}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title={
                          isCollapsed
                            ? t("mediaFileTable.expand")
                            : t("mediaFileTable.collapse")
                        }
                        aria-label={
                          isCollapsed
                            ? t("mediaFileTable.expand")
                            : t("mediaFileTable.collapse")
                        }
                      >
                        {isCollapsed ? (
                          <ChevronRightIcon className="size-4" />
                        ) : (
                          <ChevronDownIcon className="size-4" />
                        )}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            }

            // ── Folder file row ──
            if (row.type === "folderFile") {
              const folderFileInner = (
                <TableRow key={`${row.id}-${index}`} onDoubleClick={onDoubleClick ? () => onDoubleClick(row) : undefined}>
                  {showCheckboxColumn && (
                    <TableCell className="w-10 shrink-0 px-0 py-1" />
                  )}
                  <TableCell className="px-2 py-1 font-mono w-[100px]">
                    {row.id}
                  </TableCell>
                  <TableCell
                    colSpan={visibleColumnCount - (showCheckboxColumn ? 2 : 1)}
                    className="max-w-px px-2 py-1 truncate"
                    title={row.path}
                  >
                    {getDisplayPath(row.path, mediaFolderPath)}
                  </TableCell>
                </TableRow>
              )

              const folderFileItems = contextMenuConfig?.folderFileRowItems ?? []
              const hasMenu = folderFileItems.some((item) => item.onClick)

              if (!hasMenu) {
                return folderFileInner
              }

              return (
                <ContextMenu key={`${row.id}-${index}`}>
                  <ContextMenuTrigger asChild>{folderFileInner}</ContextMenuTrigger>
                  <ContextMenuContent>
                    {folderFileItems.map((item) => {
                      if (!item.onClick) return null
                      return (
                        <ContextMenuItem
                          key={item.id}
                          disabled={resolveDisabled(item.disabled, row)}
                          onClick={() => item.onClick?.(row)}
                        >
                          {item.label}
                        </ContextMenuItem>
                      )
                    })}
                  </ContextMenuContent>
                </ContextMenu>
              )
            }

            // ── Data (episode) row ──
            const sectionId = sectionIdByIndex.get(index)
            if (sectionId && collapsedIds.has(sectionId)) {
              return null
            }

            const isRowDisabled = row.disabled === true

            const dataRowInner = (
              <TableRow
                key={`${row.season}-${row.episode}-${index}`}
                className={cn(isRowDisabled && "opacity-50")}
                onDoubleClick={onDoubleClick ? () => onDoubleClick(row) : undefined}
                >
                {showCheckboxColumn && (
                  <TableCell className="w-10 shrink-0 px-0 py-1 text-center align-middle">
                    <input
                      type="checkbox"
                      role="checkbox"
                      className={cn(
                        "h-3.5 w-3.5",
                        isRowDisabled
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer",
                      )}
                      checked={row.checked}
                      disabled={isRowDisabled}
                      onChange={(e) => {
                        if (isRowDisabled) return
                        onCheck?.(row, e.target.checked)
                      }}
                    />
                  </TableCell>
                )}
                {showIdColumn && (
                  <TableCell className="px-2 py-1 font-mono">{`S${String(row.season).padStart(2, "0")}E${String(row.episode).padStart(2, "0")}`}</TableCell>
                )}
                {isSimpleLayout && columnVisibility.video && (
                  <TableCell className="max-w-px px-2 py-1">
                    {row.videoFile ? (
                      preview === "rename" && !row.newVideoFile ? (
                        <div
                          className="truncate text-muted-foreground/60 line-through text-xs"
                          title={row.videoFile}
                        >
                          {getDisplayPath(row.videoFile, mediaFolderPath)}
                        </div>
                      ) : preview === "rename" &&
                        row.newVideoFile &&
                        row.videoFile !== row.newVideoFile ? (
                        <div className="min-w-0 space-y-0.5">
                          <div
                            className="truncate text-muted-foreground/60 line-through text-xs"
                            title={row.videoFile}
                            data-testid="media-file-table-old-video-file"
                          >
                            {getDisplayPath(row.videoFile, mediaFolderPath)}
                          </div>
                          <div
                            className="truncate text-foreground font-medium"
                            title={row.newVideoFile}
                            data-testid="media-file-table-new-video-file"
                          >
                            {getDisplayPath(row.newVideoFile, mediaFolderPath)}
                          </div>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "truncate",
                            isRowDisabled && "text-muted-foreground/60 text-xs",
                          )}
                          title={row.videoFile}
                        >
                          {getDisplayPath(row.videoFile, mediaFolderPath)}
                        </div>
                      )
                    ) : preview === "recognize" ? (
                      previewStatus === "loading" ? (
                        <span className="text-muted-foreground text-xs">
                          <Spinner className="size-4" />
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          {t("mediaFileTable.unrecognizedVideoFile", {
                            defaultValue: "Cannot recognize video file",
                          })}
                        </span>
                      )
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                )}
                {isSimpleLayout && showThumbnailColumn && (
                  <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                    {row.thumbnail ? (
                      <HoverCard openDelay={200} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <div className="flex items-center justify-center cursor-default">
                            <UICheckCell value={row.thumbnail} />
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent
                          side="right"
                          align="center"
                          className="w-auto max-w-[320px] p-1"
                        >
                          <UIThumbnailImage
                            thumbnailPath={row.thumbnail}
                            mediaFolderPath={mediaFolderPath}
                          />
                        </HoverCardContent>
                      </HoverCard>
                    ) : (
                      <UICheckCell value={row.thumbnail} />
                    )}
                  </TableCell>
                )}
                {!isSimpleLayout && showThumbnailColumn && (
                  <TableCell
                    className={cn(
                      isPreviewLayout && "w-[160px] min-w-[160px] px-1 py-1 align-top",
                      layout === "detail" &&
                        !isPreviewLayout &&
                        "w-[100px] min-w-[100px] px-1 py-1 align-top",
                    )}
                  >
                    {isPreviewLayout ? (
                      row.thumbnail ? (
                        <UIThumbnailImage
                          thumbnailPath={row.thumbnail}
                          mediaFolderPath={mediaFolderPath}
                          className="max-h-[140px] w-auto rounded object-contain"
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )
                    ) : layout === "detail" ? (
                      row.thumbnail ? (
                        <UIThumbnailImage
                          thumbnailPath={row.thumbnail}
                          mediaFolderPath={mediaFolderPath}
                          className="max-h-[72px] w-auto rounded object-contain"
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )
                    ) : row.thumbnail ? (
                      <HoverCard openDelay={200} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <div className="flex items-center justify-center cursor-default">
                            <UICheckCell value={row.thumbnail} />
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent
                          side="right"
                          align="center"
                          className="w-auto max-w-[320px] p-1"
                        >
                          <UIThumbnailImage
                            thumbnailPath={row.thumbnail}
                            mediaFolderPath={mediaFolderPath}
                          />
                        </HoverCardContent>
                      </HoverCard>
                    ) : (
                      <UICheckCell value={row.thumbnail} />
                    )}
                  </TableCell>
                )}
                {!isSimpleLayout && columnVisibility.video && (
                  <TableCell className="max-w-px px-2 py-1">
                    {isPreviewLayout ? (
                      <div className="min-w-0 space-y-2">
                        <div
                          className="truncate font-medium text-foreground"
                          title={`${row.season}-${row.episode} ${row.episodeTitle || ""}`.trim()}
                        >
                          {`S${String(row.season).padStart(2, "0")}E${String(row.episode).padStart(2, "0")}`}{" "}
                          {row.episodeTitle ? `· ${row.episodeTitle}` : ""}
                        </div>
                        {row.videoFile ? (
                          <>
                            <div
                              className={cn(
                                "truncate text-xs",
                                isRowDisabled
                                  ? "text-muted-foreground/60"
                                  : "text-muted-foreground",
                              )}
                              title={row.videoFile}
                            >
                              {getDisplayPath(row.videoFile, mediaFolderPath)}
                            </div>
                            {!isRowDisabled && renderPreviewContent?.(row)}
                          </>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </div>
                    ) : layout === "detail" ? (
                      <div className="min-w-0 space-y-0.5">
                        <div
                          className="truncate font-medium text-foreground"
                          title={
                            row.episodeTitle ||
                            `${row.season}-${row.episode}`
                          }
                        >
                          {row.episodeTitle ||
                            `S${String(row.season).padStart(2, "0")}E${String(row.episode).padStart(2, "0")}` ||
                            "-"}
                        </div>
                        {row.videoFile ? (
                          preview === "rename" &&
                          row.newVideoFile &&
                          row.videoFile !== row.newVideoFile ? (
                            <>
                              <div
                                className="truncate text-muted-foreground/60 line-through text-xs"
                                title={row.videoFile}
                              >
                                {getDisplayPath(row.videoFile, mediaFolderPath)}
                              </div>
                              <div
                                className="truncate text-foreground text-xs"
                                title={row.newVideoFile}
                              >
                                {getDisplayPath(row.newVideoFile, mediaFolderPath)}
                              </div>
                            </>
                          ) : (
                            <div
                              className={cn(
                                "truncate text-xs",
                                isRowDisabled
                                  ? "text-muted-foreground/60"
                                  : "text-muted-foreground",
                              )}
                              title={row.videoFile}
                            >
                              {getDisplayPath(row.videoFile, mediaFolderPath)}
                            </div>
                          )
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </div>
                    ) : row.videoFile ? (
                      preview === "rename" &&
                      row.newVideoFile &&
                      row.videoFile !== row.newVideoFile ? (
                        <div className="min-w-0 space-y-0.5">
                          <div
                            className="truncate text-muted-foreground/60 line-through text-xs"
                            title={row.videoFile}
                          >
                            {getDisplayPath(row.videoFile, mediaFolderPath)}
                          </div>
                          <div
                            className="truncate text-foreground font-medium"
                            title={row.newVideoFile}
                          >
                            {getDisplayPath(row.newVideoFile, mediaFolderPath)}
                          </div>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "truncate",
                            isRowDisabled && "text-muted-foreground/60 text-xs",
                          )}
                          title={row.videoFile}
                        >
                          {getDisplayPath(row.videoFile, mediaFolderPath)}
                        </div>
                      )
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                )}
                {columnVisibility.subtitle && (
                  <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                    <UICheckCell value={row.subtitle} />
                  </TableCell>
                )}
                {columnVisibility.nfo && (
                  <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
                    <UICheckCell value={row.nfo} />
                  </TableCell>
                )}
              </TableRow>
            )

            // ── Data row context menu ──
            const dataRowItems = contextMenuConfig?.dataRowItems ?? []
            const hasMenu = dataRowItems.some((item) => item.onClick)

            if (!hasMenu) {
              return dataRowInner
            }

            return (
              <ContextMenu key={`${row.season}-${row.episode}-${index}`}>
                <ContextMenuTrigger asChild>{dataRowInner}</ContextMenuTrigger>
                <ContextMenuContent>
                  {dataRowItems.map((item) => {
                    if (!item.onClick) return null
                    return (
                      <ContextMenuItem
                        key={item.id}
                        disabled={resolveDisabled(item.disabled, row)}
                        onClick={() => item.onClick?.(row)}
                      >
                        {item.label}
                      </ContextMenuItem>
                    )
                  })}
                </ContextMenuContent>
              </ContextMenu>
            )
          })}
        </TableBody>
      </Table>
    </section>
  )
}
