import { Spinner } from "@/components/ui/spinner"
import { isAbsPath, join, relative } from "@/lib/path"
import { Path } from "@smm/utils/path"
import { pathToFileURL } from "@smm/utils/url"
import { TableBody, TableCell } from "@/components/ui/table"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { CheckIcon, MinusIcon } from "lucide-react"
import Image from "@/components/Image"
import { cn } from "@/lib/utils"
import { forwardRef, type ComponentProps, type ReactNode } from "react"
import type {
  MediaFileTableEpisodeData,
  UIMediaFileDataRow,
  UIMediaFileFolderRow,
  UIMediaFileTableContextMenuConfig,
} from "./UIMediaFileTable"
import {
  MediaFileTableColGroup,
  MediaFileTableRowCells,
  buildMediaFileTableColumnLayout,
  type MediaFileTableColumnLayout,
} from "./mediaFileTableColumns"

export type MediaFileTableColumnKey = "video" | "thumbnail" | "subtitle" | "nfo"

/** Layout/column context shared by folder-file and episode rows. */
export interface MediaFileTableRowContext {
  mediaFolderPath?: string
  contextMenuConfig?: UIMediaFileTableContextMenuConfig
  preview?: "rename" | "recognize"
  previewStatus?: "loading" | "ok"
  layout: "simple" | "detail" | "preview"
  onCheck?: (row: UIMediaFileDataRow, checked: boolean) => void
  /** Whether the given episode row is currently checked (selection membership). */
  isSelected: (row: UIMediaFileDataRow) => boolean
  renderPreviewContent?: (row: UIMediaFileDataRow) => ReactNode
  onDoubleClick?: (row: UIMediaFileDataRow | UIMediaFileFolderRow) => void
  isSimpleLayout: boolean
  isPreviewLayout: boolean
  showThumbnailColumn: boolean
  showIdColumn: boolean
  showCheckboxColumn: boolean
  columnVisibility: Record<MediaFileTableColumnKey, boolean>
  columnLayout: MediaFileTableColumnLayout
  t: (key: string, options?: Record<string, unknown>) => string
}

export type MediaFileTableBodyRow =
  | { row: UIMediaFileFolderRow; index: number }
  | { row: UIMediaFileDataRow; index: number }

function resolveDisabled<R extends UIMediaFileDataRow | UIMediaFileFolderRow | MediaFileTableEpisodeData>(
  rule: boolean | ((row: R) => boolean) | undefined,
  row: R,
): boolean {
  if (rule === undefined) return false
  if (typeof rule === "function") return rule(row)
  return rule
}

export function getDisplayPath(fullPath: string, basePath: string | undefined): string {
  if (!basePath) return fullPath
  try {
    return relative(basePath, fullPath)
  } catch {
    return fullPath
  }
}

export function getThumbnailImageUrl(thumbnailPath: string, mediaFolderPath: string | undefined): string {
  const absolutePath =
    mediaFolderPath && !isAbsPath(thumbnailPath)
      ? join(mediaFolderPath, thumbnailPath)
      : thumbnailPath
  const platformPath = Path.toPlatformPath(absolutePath)
  return pathToFileURL(platformPath)
}

export function UICheckCell({ value }: { value: string | undefined }) {
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

export function UIThumbnailImage({
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

export function getMediaFileTableRowKey(
  row: UIMediaFileFolderRow | UIMediaFileDataRow,
  index: number,
): string {
  if (row.type === "folderFile") return `${row.id}-${index}`
  return `${row.season}-${row.episode}-${index}`
}

/**
 * Native `<tr>` with the same styling as shadcn `TableRow`, plus ref forwarding
 * for Radix `ContextMenuTrigger asChild`. Kept in the media module so shadcn
 * `table.tsx` can be updated without losing this behavior.
 */
export const MediaFileTableTr = forwardRef<
  HTMLTableRowElement,
  ComponentProps<"tr">
>(function MediaFileTableTr({ className, children, ...props }, ref) {
  return (
    <tr
      ref={ref}
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  )
})

export function withContextMenu<R extends UIMediaFileDataRow | UIMediaFileFolderRow>(
  rowKey: string,
  row: R,
  items: Array<{ id: string; label: string; onClick?: (row: R) => void; disabled?: boolean | ((row: R) => boolean) }>,
  inner: ReactNode,
): ReactNode {
  const hasMenu = items.some((item) => item.onClick)
  if (!hasMenu) return inner

  return (
    <ContextMenu key={rowKey}>
      <ContextMenuTrigger asChild>{inner}</ContextMenuTrigger>
      <ContextMenuContent>
        {items.map((item) => {
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

export function MediaFileTableFolderFileRow({
  ctx,
  row,
  index,
}: {
  ctx: MediaFileTableRowContext
  row: UIMediaFileFolderRow
  index: number
}) {
  const rowKey = getMediaFileTableRowKey(row, index)
  const displayPath = getDisplayPath(row.path, ctx.mediaFolderPath)
  const { columnLayout } = ctx

  const videoContent =
    columnLayout.isSimpleLayout ? (
      <span title={row.path}>{displayPath}</span>
    ) : columnLayout.isPreviewLayout || columnLayout.layout === "detail" ? (
      <div className="min-w-0 space-y-0.5">
        <div className="truncate font-medium text-foreground" title={row.id}>
          {row.id}
        </div>
        <div className="truncate text-xs text-muted-foreground" title={row.path}>
          {displayPath}
        </div>
      </div>
    ) : (
      <div className="truncate" title={row.path}>
        {displayPath}
      </div>
    )

  const emptyIconCell = columnLayout.isSimpleLayout ? (
    <UICheckCell value={undefined} />
  ) : (
    <span className="text-muted-foreground text-xs">-</span>
  )

  const inner = (
    <MediaFileTableTr
      onDoubleClick={ctx.onDoubleClick ? () => ctx.onDoubleClick?.(row) : undefined}
    >
      <MediaFileTableRowCells
        layout={columnLayout}
        idContent={row.id}
        videoContent={videoContent}
        thumbnailContent={emptyIconCell}
        subtitleContent={<UICheckCell value={undefined} />}
        nfoContent={<UICheckCell value={undefined} />}
      />
    </MediaFileTableTr>
  )

  return withContextMenu(
    rowKey,
    row,
    ctx.contextMenuConfig?.folderFileRowItems ?? [],
    inner,
  )
}

/**
 * Name/value row whose cells are rendered exactly like
 * `MediaFileTableFolderFileRow` in the simple layout: `[id: name]
 * [video: value] [thumbnail –] [subtitle –] [nfo –]`, via
 * `MediaFileTableRowCells` with the simple column layout (no checkbox
 * column, all icon columns visible). Used to list one associated file
 * (subtitle / thumbnail / NFO / …) per row.
 *
 * Renders nothing when `value` is empty, so absent associated files do not
 * produce placeholder rows (same behavior as folder-file rows, which only
 * exist for files that are actually present).
 */
export function MediaFileTableNameValueRow({
  name,
  value,
  hoverTitle,
  className,
  showCheckboxColumn = false,
}: {
  /** Row label shown in the ID column (e.g. "subtitle"). */
  name: string
  /** Path/text shown in the video column. Empty (undefined/"") → renders nothing. */
  value?: string
  /** Tooltip text shown when hovering the value. */
  hoverTitle?: string
  className?: string
  /** Render a leading empty checkbox spacer cell (keeps columns aligned when the table shows a checkbox column). */
  showCheckboxColumn?: boolean
}) {

  return (
    <MediaFileTableTr className={className}>
      <MediaFileTableRowCells
        layout={{ ...nameValueRowSimpleLayout, showCheckboxColumn }}
        idContent={name}
        videoContent={<span title={hoverTitle ?? value}>{value}</span>}
        thumbnailContent={<UICheckCell value={undefined} />}
        subtitleContent={<UICheckCell value={undefined} />}
        nfoContent={<UICheckCell value={undefined} />}
      />
    </MediaFileTableTr>
  )
}

/** Simple layout (no checkbox, all icon columns) used by `MediaFileTableNameValueRow`. */
const nameValueRowSimpleLayout: MediaFileTableColumnLayout = buildMediaFileTableColumnLayout({
  layout: "simple",
  preview: undefined,
  columnVisibility: { video: true, thumbnail: true, subtitle: true, nfo: true },
})

function renderEpisodeSimpleVideoContent(
  ctx: MediaFileTableRowContext,
  row: UIMediaFileDataRow,
  isRowDisabled: boolean,
): ReactNode {
  if (row.videoFile) {
    if (ctx.preview === "rename" && !row.newVideoFile && ctx.isSelected(row)) {
      return (
        <div
          className="truncate text-muted-foreground/60 line-through text-xs"
          title={row.videoFile}
        >
          {getDisplayPath(row.videoFile, ctx.mediaFolderPath)}
        </div>
      )
    }
    if (
      ctx.preview === "rename" &&
      row.newVideoFile &&
      row.videoFile !== row.newVideoFile
    ) {
      return (
        <div className="min-w-0 space-y-0.5">
          <div
            className="truncate text-muted-foreground/60 line-through text-xs"
            title={row.videoFile}
            data-testid="media-file-table-old-video-file"
          >
            {getDisplayPath(row.videoFile, ctx.mediaFolderPath)}
          </div>
          <div
            className="truncate text-foreground font-medium"
            title={row.newVideoFile}
            data-testid="media-file-table-new-video-file"
          >
            {getDisplayPath(row.newVideoFile, ctx.mediaFolderPath)}
          </div>
        </div>
      )
    }
    return (
      <div
        className={cn("truncate", isRowDisabled && "text-muted-foreground/60 text-xs")}
        title={row.videoFile}
      >
        {getDisplayPath(row.videoFile, ctx.mediaFolderPath)}
      </div>
    )
  }
  if (ctx.preview === "recognize") {
    return ctx.previewStatus === "loading" ? (
      <span className="text-muted-foreground text-xs">
        <Spinner className="size-4" />
      </span>
    ) : (
      <span className="text-muted-foreground text-xs">
        {ctx.t("mediaFileTable.unrecognizedVideoFile", {
          defaultValue: "Cannot recognize video file",
        })}
      </span>
    )
  }
  return <span className="text-muted-foreground">-</span>
}

function renderEpisodeThumbnailContent(
  ctx: MediaFileTableRowContext,
  row: UIMediaFileDataRow,
): ReactNode {
  const { columnLayout } = ctx

  if (columnLayout.isPreviewLayout) {
    return row.thumbnail ? (
      <UIThumbnailImage
        thumbnailPath={row.thumbnail}
        mediaFolderPath={ctx.mediaFolderPath}
        className="max-h-[140px] w-auto rounded object-contain"
      />
    ) : (
      <span className="text-muted-foreground text-xs">-</span>
    )
  }

  if (columnLayout.layout === "detail") {
    return row.thumbnail ? (
      <UIThumbnailImage
        thumbnailPath={row.thumbnail}
        mediaFolderPath={ctx.mediaFolderPath}
        className="max-h-[72px] w-auto rounded object-contain"
      />
    ) : (
      <span className="text-muted-foreground text-xs">-</span>
    )
  }

  if (!row.thumbnail) {
    return <UICheckCell value={row.thumbnail} />
  }

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div className="flex items-center justify-center cursor-default">
          <UICheckCell value={row.thumbnail} />
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="center" className="w-auto max-w-[320px] p-1">
        <UIThumbnailImage thumbnailPath={row.thumbnail} mediaFolderPath={ctx.mediaFolderPath} />
      </HoverCardContent>
    </HoverCard>
  )
}

function renderEpisodeDetailVideoContent(
  ctx: MediaFileTableRowContext,
  row: UIMediaFileDataRow,
  isRowDisabled: boolean,
): ReactNode {
  const { columnLayout } = ctx

  if (columnLayout.isPreviewLayout) {
    return (
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
                isRowDisabled ? "text-muted-foreground/60" : "text-muted-foreground",
              )}
              title={row.videoFile}
            >
              {getDisplayPath(row.videoFile, ctx.mediaFolderPath)}
            </div>
            {!isRowDisabled && ctx.renderPreviewContent?.(row)}
          </>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )}
      </div>
    )
  }

  if (columnLayout.layout === "detail") {
    return (
      <div className="min-w-0 space-y-0.5">
        <div
          className="truncate font-medium text-foreground"
          title={row.episodeTitle || `${row.season}-${row.episode}`}
        >
          {row.episodeTitle ||
            `S${String(row.season).padStart(2, "0")}E${String(row.episode).padStart(2, "0")}` ||
            "-"}
        </div>
        {row.videoFile ? (
          ctx.preview === "rename" &&
          row.newVideoFile &&
          row.videoFile !== row.newVideoFile ? (
            <>
              <div
                className="truncate text-muted-foreground/60 line-through text-xs"
                title={row.videoFile}
              >
                {getDisplayPath(row.videoFile, ctx.mediaFolderPath)}
              </div>
              <div className="truncate text-foreground text-xs" title={row.newVideoFile}>
                {getDisplayPath(row.newVideoFile, ctx.mediaFolderPath)}
              </div>
            </>
          ) : (
            <div
              className={cn(
                "truncate text-xs",
                isRowDisabled ? "text-muted-foreground/60" : "text-muted-foreground",
              )}
              title={row.videoFile}
            >
              {getDisplayPath(row.videoFile, ctx.mediaFolderPath)}
            </div>
          )
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )}
      </div>
    )
  }

  if (row.videoFile) {
    if (
      ctx.preview === "rename" &&
      row.newVideoFile &&
      row.videoFile !== row.newVideoFile
    ) {
      return (
        <div className="min-w-0 space-y-0.5">
          <div
            className="truncate text-muted-foreground/60 line-through text-xs"
            title={row.videoFile}
          >
            {getDisplayPath(row.videoFile, ctx.mediaFolderPath)}
          </div>
          <div className="truncate text-foreground font-medium" title={row.newVideoFile}>
            {getDisplayPath(row.newVideoFile, ctx.mediaFolderPath)}
          </div>
        </div>
      )
    }
    return (
      <div
        className={cn("truncate", isRowDisabled && "text-muted-foreground/60 text-xs")}
        title={row.videoFile}
      >
        {getDisplayPath(row.videoFile, ctx.mediaFolderPath)}
      </div>
    )
  }

  return <span className="text-muted-foreground">-</span>
}

function MediaFileTableEpisodeRow({
  ctx,
  row,
  index,
}: {
  ctx: MediaFileTableRowContext
  row: UIMediaFileDataRow
  index: number
}) {
  const isRowDisabled = row.disabled === true
  const rowKey = getMediaFileTableRowKey(row, index)

  const inner = (
    <MediaFileTableTr
      className={cn(isRowDisabled && "opacity-50")}
      onDoubleClick={ctx.onDoubleClick ? () => ctx.onDoubleClick?.(row) : undefined}
    >
      <MediaFileTableRowCells
        layout={ctx.columnLayout}
        idContent={`S${String(row.season).padStart(2, "0")}E${String(row.episode).padStart(2, "0")}`}
        checkboxContent={
          <input
            type="checkbox"
            role="checkbox"
            className={cn(
              "h-3.5 w-3.5",
              isRowDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            )}
            checked={isRowDisabled ? false : ctx.isSelected(row)}
            disabled={isRowDisabled}
            onChange={(e) => {
              if (isRowDisabled) return
              ctx.onCheck?.(row, e.target.checked)
            }}
          />
        }
        videoContent={
          ctx.columnLayout.isSimpleLayout
            ? renderEpisodeSimpleVideoContent(ctx, row, isRowDisabled)
            : renderEpisodeDetailVideoContent(ctx, row, isRowDisabled)
        }
        thumbnailContent={renderEpisodeThumbnailContent(ctx, row)}
        subtitleContent={<UICheckCell value={row.subtitle} />}
        nfoContent={<UICheckCell value={row.nfo} />}
      />
    </MediaFileTableTr>
  )

  return withContextMenu(
    rowKey,
    row,
    ctx.contextMenuConfig?.dataRowItems ?? [],
    inner,
  )
}

/**
 * Renders a folder-file or episode row with shared table chrome (border, hover).
 */
export function MediaFileTableRow({
  ctx,
  row,
  index,
}: {
  ctx: MediaFileTableRowContext
  row: UIMediaFileFolderRow | UIMediaFileDataRow
  index: number
}) {
  if (row.type === "folderFile") {
    return <MediaFileTableFolderFileRow ctx={ctx} row={row} index={index} />
  }
  return <MediaFileTableEpisodeRow ctx={ctx} row={row} index={index} />
}

/**
 * Renders multiple data rows inside one `<tbody>`.
 * Used for standalone folder files and collapsible section content alike.
 */
export function MediaFileTableRowsBody({
  ctx,
  rows,
  className,
  preserveLastRowBorder = false,
}: {
  ctx: MediaFileTableRowContext
  rows: MediaFileTableBodyRow[]
  className?: string
  /** Keep bottom border on the last row (for nested section tables). */
  preserveLastRowBorder?: boolean
}) {
  return (
    <TableBody
      className={cn(preserveLastRowBorder && "[&_tr:last-child]:border-b", className)}
    >
      {rows.map(({ row, index }) => (
        <MediaFileTableRow
          key={getMediaFileTableRowKey(row, index)}
          ctx={ctx}
          row={row}
          index={index}
        />
      ))}
    </TableBody>
  )
}

/**
 * Nested table used inside collapsible sections so column widths match the outer table.
 */
export function MediaFileTableSectionRows({
  columnLayout,
  ctx,
  rows,
}: {
  columnLayout: MediaFileTableColumnLayout
  ctx: MediaFileTableRowContext
  rows: MediaFileTableBodyRow[]
}) {
  return (
    <table className="w-full table-fixed text-xs">
      <MediaFileTableColGroup layout={columnLayout} />
      <MediaFileTableRowsBody ctx={ctx} rows={rows} preserveLastRowBorder />
    </table>
  )
}

/**
 * A single item in an episode row's right-click menu.
 * Callbacks receive the episode's data (`MediaFileTableEpisodeData`).
 */
export interface EpisodeContextMenuItem {
  /** Unique id. */
  id: string
  /** Display label (already translated). */
  label: string
  /** Called on click. Falsy → the item is hidden. */
  onClick?: (episode: MediaFileTableEpisodeData) => void
  /** Disabled state. Function form receives the episode for per-row logic. */
  disabled?: boolean | ((episode: MediaFileTableEpisodeData) => boolean)
}

/**
 * Wraps an episode row (e.g. a `MediaFileTableEpisodeSimpleRow`) with its
 * right-click menu.
 *
 * Context-menu wrapper for the `MediaFileTableEpisodeData` data model (the
 * deprecated `UIMediaFileDataRow`-based path keeps using `withContextMenu`).
 * Returns the row unchanged when no item provides an `onClick`.
 *
 * NOTE (Radix): `ContextMenuTrigger` is used with `asChild`, so the child row
 * element must forward the trigger props/ref it receives onto its DOM `<tr>`
 * (that is what `MediaFileTableTr` exists for). `MediaFileTableEpisodeSimpleRow`
 * forwards unknown props to its native `<tr>`, so it can be passed directly.
 */
export function EpisodeContextMenu({
  episode,
  items = [],
  children,
}: {
  /** Episode data passed to item `onClick`/`disabled` callbacks. */
  episode: MediaFileTableEpisodeData
  /** Right-click menu items. Omit for no context menu. */
  items?: EpisodeContextMenuItem[]
  /** The rendered row element (must forward props to its DOM `<tr>`). */
  children: ReactNode
}) {
  const hasMenu = items.some((item) => item.onClick)
  if (!hasMenu) return <>{children}</>

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {items.map((item) => {
          if (!item.onClick) return null
          return (
            <ContextMenuItem
              key={item.id}
              disabled={resolveDisabled(item.disabled, episode)}
              onClick={() => item.onClick?.(episode)}
            >
              {item.label}
            </ContextMenuItem>
          )
        })}
      </ContextMenuContent>
    </ContextMenu>
  )
}

/** `S01E01`-style id shown in the ID column of a simple episode row. */
function formatEpisodeId(season: number, episode: number): string {
  return `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`
}

function renderSimpleRowVideoContent({
  path,
  renameTarget,
  recognizeTarget,
  isDisabled,
}: {
  path: string
  /** Rename preview target (old path is struck through). */
  renameTarget?: string
  /** Recognize preview target (currently linked path is struck through). */
  recognizeTarget?: string
  isDisabled: boolean
}): ReactNode {
  if (renameTarget !== undefined) {
    return (
      <div className="min-w-0 space-y-0.5">
        <div
          className="truncate text-muted-foreground/60 line-through text-xs"
          title={path}
          data-testid="media-file-table-old-video-file"
        >
          {path}
        </div>
        <div
          className="truncate text-foreground font-medium"
          title={renameTarget}
          data-testid="media-file-table-new-video-file"
        >
          {renameTarget}
        </div>
      </div>
    )
  }

  if (recognizeTarget !== undefined) {
    return (
      <div className="min-w-0 space-y-0.5">
        <div
          className="truncate text-muted-foreground/60 line-through text-xs"
          title={path}
        >
          {path}
        </div>
        <div className="truncate text-foreground font-medium" title={recognizeTarget}>
          {recognizeTarget}
        </div>
      </div>
    )
  }

  if (path !== "") {
    return (
      <div
        className={cn("truncate", isDisabled && "text-muted-foreground/60 text-xs")}
        title={path}
      >
        {path}
      </div>
    )
  }

  return <span className="text-muted-foreground">-</span>
}

export interface MediaFileTableEpisodeSimpleRowProps {
  season: number,
  episode: number,
  title: string,
  path: string,
  /** Absolute path of the thumbnail file (shown on hover, if present). */
  thumbnailPath?: string,
  /** Absolute path of the subtitle file (presence indicator only). */
  subtitlePath?: string,
  /** Absolute path of the nfo file (presence indicator only). */
  nfoPath?: string,
  isChecked?: boolean,
  isDisabled?: boolean,
  isCheckboxDisabled?: boolean,
  newFilePath?: string,
  newRecognizedFilePath?: string
  onCheck?: (isChecked: boolean) => void,
  onDoubleClick?: () => void,
  checboxVisible?: boolean,
}

/**
 * Compact single-line row for the `simple` layout, rendered from plain data
 * props (no `UIMediaFileDataRow`/layout context) so panels can feed it from
 * season/episode data directly.
 *
 * Cell order is fixed and matches a simple-layout colgroup:
 * `[checkbox] [SxxExx id] [video path] [thumbnail] [subtitle] [nfo]`. The
 * checkbox column is only rendered while `onCheck` is provided (e.g. during a
 * rename/recognize preview). Icon columns show a check/minus; hovering the
 * thumbnail check opens an image preview of `thumbnailPath`.
 *
 * The video cell renders the old→new path pair while a preview target
 * (`newFilePath`/`newRecognizedFilePath`) differs from `path`; otherwise it
 * shows `path` (muted when `isDisabled`) or `-` when no file is linked.
 *
 * `title` is kept in the props API (episode data carries it) but is not
 * rendered by this layout.
 *
 * Renders a native `<tr>` + `TableCell`s (no `MediaFileTableTr`/
 * `MediaFileTableRowCells`). Unknown props are forwarded to the `<tr>`, which
 * lets `EpisodeContextMenu` attach a right-click menu via
 * `ContextMenuTrigger asChild`.
 */
export function MediaFileTableEpisodeSimpleRow({
  season,
  episode,
  path,
  thumbnailPath,
  subtitlePath,
  nfoPath,
  isChecked = false,
  isDisabled = false,
  isCheckboxDisabled = false,
  newFilePath = undefined,
  newRecognizedFilePath = undefined,
  onCheck = undefined,
  onDoubleClick = undefined,
  // `title` is part of the episode data API but is not rendered in this
  // layout; alias it out so it does not leak onto the `<tr>` as a native
  // tooltip via `...rowProps`.
  title: _title,
  checboxVisible = false,
  ...rowProps
}: MediaFileTableEpisodeSimpleRowProps) {
  const showCheckbox = checboxVisible
  const checkboxDisabled = isDisabled || isCheckboxDisabled

  const renameTarget =
    newFilePath !== undefined && newFilePath !== path ? newFilePath : undefined
  const recognizeTarget =
    renameTarget === undefined &&
    newRecognizedFilePath !== undefined &&
    newRecognizedFilePath !== path
      ? newRecognizedFilePath
      : undefined

  return (
    <tr
      {...rowProps}
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        isDisabled && "opacity-50",
      )}
      onDoubleClick={onDoubleClick}
    >
      {showCheckbox && (
        <TableCell className="w-10 shrink-0 px-0 py-1 text-center align-middle">
          <input
            type="checkbox"
            role="checkbox"
            className={cn(
              "h-3.5 w-3.5",
              checkboxDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            )}
            checked={checkboxDisabled ? false : isChecked}
            disabled={checkboxDisabled}
            onChange={(e) => {
              if (checkboxDisabled) return
              onCheck?.(e.target.checked)
            }}
          />
        </TableCell>
      )}
      <TableCell className="px-2 py-1 font-mono w-[100px]">
        {formatEpisodeId(season, episode)}
      </TableCell>
      <TableCell className="max-w-px px-2 py-1 truncate">
        {renderSimpleRowVideoContent({
          path,
          renameTarget,
          recognizeTarget,
          isDisabled,
        })}
      </TableCell>
      <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
        {thumbnailPath ? (
          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <div className="flex items-center justify-center cursor-default">
                <UICheckCell value={thumbnailPath} />
              </div>
            </HoverCardTrigger>
            <HoverCardContent side="right" align="center" className="w-auto max-w-[320px] p-1">
              <UIThumbnailImage thumbnailPath={thumbnailPath} mediaFolderPath={undefined} />
            </HoverCardContent>
          </HoverCard>
        ) : (
          <UICheckCell value={undefined} />
        )}
      </TableCell>
      <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
        <UICheckCell value={subtitlePath || undefined} />
      </TableCell>
      <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
        <UICheckCell value={nfoPath || undefined} />
      </TableCell>
    </tr>
  )
}

// ========================================================================
// Detail & preview episode rows (new seasonData path)
// ========================================================================

/** Shared checkbox cell for the path-based episode rows. */
function EpisodeRowCheckboxCell({
  isChecked,
  isDisabled,
  isCheckboxDisabled = false,
  onCheck,
}: {
  isChecked: boolean
  isDisabled: boolean
  isCheckboxDisabled?: boolean
  onCheck?: (checked: boolean) => void
}) {
  const checkboxDisabled = isDisabled || isCheckboxDisabled
  return (
    <TableCell className="w-10 shrink-0 px-0 py-1 text-center align-middle">
      <input
        type="checkbox"
        role="checkbox"
        className={cn(
          "h-3.5 w-3.5",
          checkboxDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        )}
        checked={checkboxDisabled ? false : isChecked}
        disabled={checkboxDisabled}
        onChange={(e) => {
          if (checkboxDisabled) return
          onCheck?.(e.target.checked)
        }}
      />
    </TableCell>
  )
}

export interface MediaFileTableEpisodeDetailRowProps {
  season: number
  episode: number
  /** Episode title (e.g. from TMDB). Shown as the first video-cell line. */
  title: string
  /** Video file path shown under the title. Empty → `-`. */
  path: string
  /** Absolute path of the thumbnail file (rendered as a cover image). */
  thumbnailPath?: string
  /** Absolute path of the subtitle file (presence indicator only). */
  subtitlePath?: string
  /** Absolute path of the nfo file (presence indicator only). */
  nfoPath?: string
  isChecked?: boolean
  isDisabled?: boolean
  isCheckboxDisabled?: boolean
  onCheck?: (isChecked: boolean) => void
  onDoubleClick?: () => void
}

/**
 * Row for the `detail` layout, rendered from plain data props (no
 * `UIMediaFileDataRow`/layout context) so panels can feed it from
 * season/episode data directly.
 *
 * Cell order is fixed and matches a detail-layout colgroup:
 * `[checkbox] [SxxExx id] [cover thumbnail] [episode title + video path]
 * [subtitle] [nfo]`. The checkbox column is only rendered while `onCheck` is
 * provided. The thumbnail cell renders `thumbnailPath` as a cover image (or
 * `-`); subtitle/nfo cells show presence icons.
 *
 * Renders a native `<tr>` + `TableCell`s (no `MediaFileTableTr`/
 * `MediaFileTableRowCells`). Unknown props are forwarded to the `<tr>`, which
 * lets `EpisodeContextMenu` attach a right-click menu via
 * `ContextMenuTrigger asChild`.
 */
export function MediaFileTableEpisodeDetailRow({
  season,
  episode,
  title,
  path,
  thumbnailPath,
  subtitlePath,
  nfoPath,
  isChecked = false,
  isDisabled = false,
  isCheckboxDisabled = false,
  onCheck = undefined,
  onDoubleClick = undefined,
  ...rowProps
}: MediaFileTableEpisodeDetailRowProps) {
  return (
    <tr
      {...rowProps}
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        isDisabled && "opacity-50",
      )}
      onDoubleClick={onDoubleClick}
    >
      {onCheck !== undefined && (
        <EpisodeRowCheckboxCell
          isChecked={isChecked}
          isDisabled={isDisabled}
          isCheckboxDisabled={isCheckboxDisabled}
          onCheck={onCheck}
        />
      )}
      <TableCell className="px-2 py-1 font-mono w-[100px]">
        {formatEpisodeId(season, episode)}
      </TableCell>
      <TableCell className="w-[100px] min-w-[100px] px-1 py-1 align-top">
        {thumbnailPath ? (
          <UIThumbnailImage
            thumbnailPath={thumbnailPath}
            mediaFolderPath={undefined}
            className="max-h-[72px] w-auto rounded object-contain"
          />
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )}
      </TableCell>
      <TableCell className="max-w-px px-2 py-1">
        <div className="min-w-0 space-y-0.5">
          <div
            className="truncate font-medium text-foreground"
            title={title || `${season}-${episode}`}
          >
            {title || formatEpisodeId(season, episode)}
          </div>
          {path !== "" ? (
            <div
              className={cn(
                "truncate text-xs",
                isDisabled ? "text-muted-foreground/60" : "text-muted-foreground",
              )}
              title={path}
            >
              {path}
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          )}
        </div>
      </TableCell>
      <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
        <UICheckCell value={subtitlePath || undefined} />
      </TableCell>
      <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
        <UICheckCell value={nfoPath || undefined} />
      </TableCell>
    </tr>
  )
}

export interface MediaFileTableEpisodePreviewRowProps {
  season: number
  episode: number
  /** Episode title (e.g. from TMDB). Shown after the `SxxExx` id. */
  title: string
  /** Video file path shown under the id + title line. Empty → `-`. */
  path: string
  /** Absolute path of the thumbnail file (rendered as a cover image). */
  thumbnailPath?: string
  /** Absolute path of the subtitle file (presence indicator only). */
  subtitlePath?: string
  /** Absolute path of the nfo file (presence indicator only). */
  nfoPath?: string
  isChecked?: boolean
  isDisabled?: boolean
  isCheckboxDisabled?: boolean
  onCheck?: (isChecked: boolean) => void
  onDoubleClick?: () => void
}

/**
 * Row for the `preview` layout, rendered from plain data props (no
 * `UIMediaFileDataRow`/layout context) so panels can feed it from
 * season/episode data directly.
 *
 * Cell order is fixed and matches a preview-layout colgroup (no ID column):
 * `[checkbox] [cover thumbnail] [SxxExx · title + video path] [subtitle]
 * [nfo]`. The checkbox column is only rendered while `onCheck` is provided.
 * The thumbnail cell renders `thumbnailPath` as a larger cover image (or
 * `-`); subtitle/nfo cells show presence icons.
 *
 * Renders a native `<tr>` + `TableCell`s (no `MediaFileTableTr`/
 * `MediaFileTableRowCells`). Unknown props are forwarded to the `<tr>`, which
 * lets `EpisodeContextMenu` attach a right-click menu via
 * `ContextMenuTrigger asChild`.
 */
export function MediaFileTableEpisodePreviewRow({
  season,
  episode,
  title,
  path,
  thumbnailPath,
  subtitlePath,
  nfoPath,
  isChecked = false,
  isDisabled = false,
  isCheckboxDisabled = false,
  onCheck = undefined,
  onDoubleClick = undefined,
  ...rowProps
}: MediaFileTableEpisodePreviewRowProps) {
  return (
    <tr
      {...rowProps}
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        isDisabled && "opacity-50",
      )}
      onDoubleClick={onDoubleClick}
    >
      {onCheck !== undefined && (
        <EpisodeRowCheckboxCell
          isChecked={isChecked}
          isDisabled={isDisabled}
          isCheckboxDisabled={isCheckboxDisabled}
          onCheck={onCheck}
        />
      )}
      <TableCell className="w-[160px] min-w-[160px] px-1 py-1 align-top">
        {thumbnailPath ? (
          <UIThumbnailImage
            thumbnailPath={thumbnailPath}
            mediaFolderPath={undefined}
            className="max-h-[140px] w-auto rounded object-contain"
          />
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )}
      </TableCell>
      <TableCell className="max-w-px px-2 py-1">
        <div className="min-w-0 space-y-2">
          <div
            className="truncate font-medium text-foreground"
            title={`${season}-${episode} ${title || ""}`.trim()}
          >
            {formatEpisodeId(season, episode)}
            {title ? ` · ${title}` : ""}
          </div>
          {path !== "" ? (
            <div
              className={cn(
                "truncate text-xs",
                isDisabled ? "text-muted-foreground/60" : "text-muted-foreground",
              )}
              title={path}
            >
              {path}
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          )}
        </div>
      </TableCell>
      <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
        <UICheckCell value={subtitlePath || undefined} />
      </TableCell>
      <TableCell className="w-10 shrink-0 px-0 py-1 text-center">
        <UICheckCell value={nfoPath || undefined} />
      </TableCell>
    </tr>
  )
}
