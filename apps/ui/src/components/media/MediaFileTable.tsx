import { useMemo, type ReactNode } from "react"
import { useTranslation } from "@/lib/i18n"
import { UIMediaFileTable } from "./UIMediaFileTable"
import type {
  UIMediaFileDataContextMenuItem,
  UIMediaFileFolderContextMenuItem,
  UIMediaFileTableContextMenuConfig,
  UIMediaFileDataRow,
  UIMediaFileTableRow,
} from "./UIMediaFileTable"
import { useMediaFileTableController } from "./useMediaFileTableController"

/**
 * Props for the business-logic wrapper around `UIMediaFileTable`.
 *
 * Mirrors `UIMediaFileTableProps` minus the raw `contextMenuConfig` —
 * `MediaFileTable` owns the right-click menu and exposes only Open / Properties.
 */
export interface MediaFileTableProps {
  data: UIMediaFileTableRow[]
  /** When set, relative file paths are resolved against this base before opening. */
  mediaFolderPath?: string
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
   * Extra data-row context menu items appended after the built-in "Open" and
   * "Properties" entries. Use this for panel-private actions (e.g. TvShow
   * and Movie panels inject their "Rename" item here) so `MediaFileTable`
   * stays free of panel-specific business logic.
   */
  extraEpisodeContextMenu?: UIMediaFileDataContextMenuItem[]
}

/**
 * Business-logic wrapper around `UIMediaFileTable`. Provides:
 *  - "Open" context menu item → `openFile` API
 *  - "Properties" context menu item → `MediaFilePropertyDialog`
 *  - caller-supplied extra items via `extraEpisodeContextMenu`
 *  - row double-click → `openFile` API
 *
 * The right-click menu and double-click behavior are owned by this component;
 * the pure UI rendering comes from `UIMediaFileTable`.
 */
export function MediaFileTable(props: MediaFileTableProps) {
  const {
    data,
    mediaFolderPath,
    preview,
    previewStatus,
    layout,
    onCheck,
    renderPreviewContent,
    extraEpisodeContextMenu,
  } = props

  const { t } = useTranslation("components")
  const ctrl = useMediaFileTableController(mediaFolderPath)

  const contextMenuConfig = useMemo<UIMediaFileTableContextMenuConfig>(() => {
    const dataRowItems: UIMediaFileDataContextMenuItem[] = [
      {
        id: "open",
        label: t("mediaFileTable.contextMenu.open"),
        onClick: (row) => {
          if (row.videoFile) ctrl.openFile(row.videoFile)
        },
        disabled: (row) => !row.videoFile,
      },
      {
        id: "properties",
        label: t("mediaFileTable.contextMenu.properties"),
        onClick: (row) => {
          if (row.videoFile) ctrl.openPropertiesDialog(row.videoFile)
        },
        disabled: (row) => !row.videoFile,
      },
      ...(extraEpisodeContextMenu ?? []),
    ]

    const folderFileRowItems: UIMediaFileFolderContextMenuItem[] = [
      {
        id: "open",
        label: t("mediaFileTable.contextMenu.open"),
        onClick: (row) => {
          if (row.path) ctrl.openFile(row.path)
        },
        disabled: (row) => !row.path,
      },
    ]

    return { dataRowItems, folderFileRowItems }
  }, [ctrl, t, extraEpisodeContextMenu])

  return (
    <UIMediaFileTable
      data={data}
      mediaFolderPath={mediaFolderPath}
      contextMenuConfig={contextMenuConfig}
      preview={preview}
      previewStatus={previewStatus}
      layout={layout}
      onCheck={onCheck}
      renderPreviewContent={renderPreviewContent}
      onDoubleClick={ctrl.handleDoubleClick}
    />
  )
}
