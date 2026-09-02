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

function renderThumbnailContent(
  ctx: MediaFileTableRowContext,
  row: UIMediaFileDataRow,
): React.ReactNode {
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

export function MediaFileTableEpisodePreviewRow({
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
