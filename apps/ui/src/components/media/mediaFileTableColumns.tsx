import { TableCell } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"
import type { MediaFileTableColumnKey } from "./MediaFileTableRow"

/** Column visibility and layout flags that drive colgroup + row cells. */
export interface MediaFileTableColumnLayout {
  showCheckboxColumn: boolean
  showIdColumn: boolean
  showThumbnailColumn: boolean
  isSimpleLayout: boolean
  isPreviewLayout: boolean
  layout: "simple" | "detail" | "preview"
  columnVisibility: Record<MediaFileTableColumnKey, boolean>
}

const CHECKBOX_COL_CLASS = "w-10"
const ID_COL_CLASS = "w-[100px]"
const ICON_COL_CLASS = "w-10"
const THUMB_DETAIL_COL_CLASS = "w-[100px]"
const THUMB_PREVIEW_COL_CLASS = "w-[160px]"

function Col({ className }: { className?: string }) {
  return <col className={className} />
}

/** Shared `<colgroup>` for outer and nested tables (`table-fixed`). */
export function MediaFileTableColGroup({ layout }: { layout: MediaFileTableColumnLayout }) {
  return (
    <colgroup>
      {layout.showCheckboxColumn && <Col className={CHECKBOX_COL_CLASS} />}
      {layout.showIdColumn && <Col className={ID_COL_CLASS} />}
      {layout.isSimpleLayout ? (
        <>
          {layout.columnVisibility.video && <Col />}
          {layout.showThumbnailColumn && <Col className={ICON_COL_CLASS} />}
        </>
      ) : (
        <>
          {layout.showThumbnailColumn && (
            <Col
              className={
                layout.isPreviewLayout
                  ? THUMB_PREVIEW_COL_CLASS
                  : layout.layout === "detail"
                    ? THUMB_DETAIL_COL_CLASS
                    : ICON_COL_CLASS
              }
            />
          )}
          {layout.columnVisibility.video && <Col />}
        </>
      )}
      {layout.columnVisibility.subtitle && <Col className={ICON_COL_CLASS} />}
      {layout.columnVisibility.nfo && <Col className={ICON_COL_CLASS} />}
    </colgroup>
  )
}

const idCellClassName = "px-2 py-1 font-mono w-[100px]"
const checkboxCellClassName = "w-10 shrink-0 px-0 py-1 text-center align-middle"
const checkboxCellEmptyClassName = "w-10 shrink-0 px-0 py-1"
const videoCellClassName = "max-w-px px-2 py-1"
const iconCellClassName = "w-10 shrink-0 px-0 py-1 text-center"

function thumbnailCellClassName(layout: MediaFileTableColumnLayout): string {
  return cn(
    layout.isPreviewLayout && "w-[160px] min-w-[160px] px-1 py-1 align-top",
    layout.layout === "detail" &&
      !layout.isPreviewLayout &&
      "w-[100px] min-w-[100px] px-1 py-1 align-top",
    layout.isSimpleLayout && iconCellClassName,
  )
}

/**
 * Renders table cells in the same column order for folder-file and episode rows.
 * Widths are enforced by `MediaFileTableColGroup`; cell classes mirror the header row.
 */
export function MediaFileTableRowCells({
  layout,
  idContent,
  checkboxContent,
  videoContent,
  thumbnailContent,
  subtitleContent,
  nfoContent,
}: {
  layout: MediaFileTableColumnLayout
  idContent: ReactNode
  checkboxContent?: ReactNode
  videoContent: ReactNode
  thumbnailContent?: ReactNode
  subtitleContent?: ReactNode
  nfoContent?: ReactNode
}) {
  return (
    <>
      {layout.showCheckboxColumn && (
        <TableCell
          className={
            checkboxContent === undefined ? checkboxCellEmptyClassName : checkboxCellClassName
          }
        >
          {checkboxContent}
        </TableCell>
      )}
      {layout.showIdColumn && (
        <TableCell className={idCellClassName}>{idContent}</TableCell>
      )}
      {layout.isSimpleLayout && layout.columnVisibility.video && (
        <TableCell className={cn(videoCellClassName, "truncate")}>{videoContent}</TableCell>
      )}
      {layout.isSimpleLayout && layout.showThumbnailColumn && (
        <TableCell className={iconCellClassName}>{thumbnailContent}</TableCell>
      )}
      {!layout.isSimpleLayout && layout.showThumbnailColumn && (
        <TableCell className={thumbnailCellClassName(layout)}>{thumbnailContent}</TableCell>
      )}
      {!layout.isSimpleLayout && layout.columnVisibility.video && (
        <TableCell className={videoCellClassName}>{videoContent}</TableCell>
      )}
      {layout.columnVisibility.subtitle && (
        <TableCell className={iconCellClassName}>{subtitleContent}</TableCell>
      )}
      {layout.columnVisibility.nfo && (
        <TableCell className={iconCellClassName}>{nfoContent}</TableCell>
      )}
    </>
  )
}

export function buildMediaFileTableColumnLayout(options: {
  layout: "simple" | "detail" | "preview"
  preview?: "rename" | "recognize"
  columnVisibility: Record<MediaFileTableColumnKey, boolean>
}): MediaFileTableColumnLayout {
  const isSimpleLayout = options.layout === "simple"
  const isPreviewLayout = options.layout === "preview"
  const showThumbnailColumn =
    (!isSimpleLayout && options.layout === "detail") ||
    isPreviewLayout ||
    options.columnVisibility.thumbnail
  const showIdColumn = options.layout !== "preview"
  const showCheckboxColumn = options.preview !== undefined

  return {
    showCheckboxColumn,
    showIdColumn,
    showThumbnailColumn,
    isSimpleLayout,
    isPreviewLayout,
    layout: options.layout,
    columnVisibility: options.columnVisibility,
  }
}
