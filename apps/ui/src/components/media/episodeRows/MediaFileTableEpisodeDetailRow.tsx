import { cn } from "@/lib/utils"
import {
  MediaFileTableTr,
  MediaFileTableRowCells,
  withContextMenu,
  UICheckCell,
  UIThumbnailImage,
  getMediaFileTableRowKey,
  getDisplayPath,
  type MediaFileTableRowContext,
} from "../MediaFileTableRow"
import type { UIMediaFileDataRow } from "../UIMediaFileTable"

function renderVideoContent(
  ctx: MediaFileTableRowContext,
  row: UIMediaFileDataRow,
  isRowDisabled: boolean,
): React.ReactNode {
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
      <div className="min-w-0 space-y-0.5">
        <div
          className="truncate font-medium text-foreground"
          title={row.episodeTitle || `${row.season}-${row.episode}`}
        >
          {row.episodeTitle ||
            `S${String(row.season).padStart(2, "0")}E${String(row.episode).padStart(2, "0")}` ||
            "-"}
        </div>
        <div
          className={cn(
            "truncate text-xs",
            isRowDisabled ? "text-muted-foreground/60" : "text-muted-foreground",
          )}
          title={row.videoFile}
        >
          {getDisplayPath(row.videoFile, ctx.mediaFolderPath)}
        </div>
      </div>
    )
  }
  return <span className="text-muted-foreground">-</span>
}

function renderThumbnailContent(
  ctx: MediaFileTableRowContext,
  row: UIMediaFileDataRow,
): React.ReactNode {
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

export function MediaFileTableEpisodeDetailRow({
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
        videoContent={renderVideoContent(ctx, row, isRowDisabled)}
        thumbnailContent={renderThumbnailContent(ctx, row)}
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
