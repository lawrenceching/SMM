import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"
import {
  MediaFileTableTr,
  MediaFileTableRowCells,
  withContextMenu,
  UICheckCell,
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

export function MediaFileTableEpisodeSimpleRow({
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
        thumbnailContent={<UICheckCell value={row.thumbnail} />}
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
