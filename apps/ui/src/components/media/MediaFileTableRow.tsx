import { Spinner } from "@/components/ui/spinner"
import { isAbsPath, join, relative } from "@/lib/path"
import { Path } from "@core/path"
import { pathToFileURL } from "@core/url"
import { TableBody } from "@/components/ui/table"
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
  UIMediaFileDataRow,
  UIMediaFileFolderRow,
  UIMediaFileTableContextMenuConfig,
} from "./UIMediaFileTable"
import {
  MediaFileTableColGroup,
  MediaFileTableRowCells,
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

function resolveDisabled<R extends UIMediaFileDataRow | UIMediaFileFolderRow>(
  rule: boolean | ((row: R) => boolean) | undefined,
  row: R,
): boolean {
  if (rule === undefined) return false
  if (typeof rule === "function") return rule(row)
  return rule
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

function getMediaFileTableRowKey(
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

function withContextMenu<R extends UIMediaFileDataRow | UIMediaFileFolderRow>(
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

function MediaFileTableFolderFileRow({
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

function renderEpisodeSimpleVideoContent(
  ctx: MediaFileTableRowContext,
  row: UIMediaFileDataRow,
  isRowDisabled: boolean,
): ReactNode {
  if (row.videoFile) {
    if (ctx.preview === "rename" && !row.newVideoFile) {
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
            checked={row.checked}
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
