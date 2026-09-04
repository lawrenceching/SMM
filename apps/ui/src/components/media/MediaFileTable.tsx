import { type ReactNode, useMemo } from "react"
import { UIMediaFileTable } from "./UIMediaFileTable"
import type {
  MediaFileTableContextMenuProps,
  UIMediaFileDataRow,
  UIMediaFileTableRow,
  UIMediaEpisodeSelection,
  MediaFileTableSeasonData,
} from "./UIMediaFileTable"
import type { MetadataFiles } from "@smm/types/MetadataFiles"
import { useMediaFileTableController } from "./useMediaFileTableController"

/**
 * Props for the business-logic wrapper around `UIMediaFileTable`.
 *
 * Mirrors `UIMediaFileTableProps` minus the raw `contextMenuConfig` —
 * `MediaFileTable` owns the right-click menu and exposes only Open / Properties.
 */
export interface MediaFileTableProps {
  seasonData?: MediaFileTableSeasonData[],
  metadataFiles?: MetadataFiles,
  subtitleFiles?: { season: number, episode: number, files: string[] }[],
  nfoFiles?: { season: number, episode: number, files: string[] }[],
  thumbnailFiles?: { season: number, episode: number, files: string[] }[],
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
  onCheck?: (season: number, episode: number, checked: boolean) => void
  /**
   * Controlled checkbox selection — which episodes are currently checked.
   * Omit → the underlying table manages the selection internally.
   */
  selectedEpisodes?: UIMediaEpisodeSelection[]
  /**
   * Renders the extra content area below the video path in `preview` layout
   * (e.g. video screenshots). Omit → the area is hidden.
   */
  renderPreviewContent?: (row: UIMediaFileDataRow) => ReactNode
  /**
   * Right-click context menu props forwarded to `UIMediaFileTable`.
   * `UIMediaFileTable` hardcodes the menu items and uses these props to
   * control visibility / disabled / callbacks.
   */
  contextMenuProps?: MediaFileTableContextMenuProps
  newFilePaths?: { season: number, episode: number, newFilePath: string }[]
  checboxVisible?: boolean
}

/**
 * Business-logic wrapper around `UIMediaFileTable`. Provides:
 *  - "Open" context menu item → `openFile` API
 *  - "Properties" context menu item → `MediaFilePropertyDialog`
 *  - caller-supplied extra items via `contextMenuProps`
 *  - row double-click → `openFile` API
 *
 * The right-click menu and double-click behavior are owned by this component;
 * the pure UI rendering comes from `UIMediaFileTable`.
 */
export function MediaFileTable(props: MediaFileTableProps) {
  const {
    data,
    seasonData,
    metadataFiles,
    subtitleFiles,
    nfoFiles,
    thumbnailFiles,
    mediaFolderPath,
    preview,
    previewStatus,
    layout,
    onCheck,
    selectedEpisodes,
    renderPreviewContent,
    contextMenuProps: contextMenuPropsProp,
    newFilePaths,
    checboxVisible = false,
  } = props

  const ctrl = useMediaFileTableController(mediaFolderPath)

  const contextMenuProps = useMemo<MediaFileTableContextMenuProps>(() => ({
    ...contextMenuPropsProp,
    onOpenMenuClick: contextMenuPropsProp?.onOpenMenuClick ?? ((row) => {
      if (row.videoFile) ctrl.openFile(row.videoFile)
    }),
    onPropertiesMenuClick: contextMenuPropsProp?.onPropertiesMenuClick ?? ((row) => {
      if (row.videoFile) ctrl.openPropertiesDialog(row.videoFile)
    }),
  }), [contextMenuPropsProp, ctrl])

  return (
    <UIMediaFileTable
      data={data}
      seasonData={seasonData}
      metadataFiles={metadataFiles}
      subtitleFiles={subtitleFiles}
      nfoFiles={nfoFiles}
      thumbnailFiles={thumbnailFiles}
      mediaFolderPath={mediaFolderPath}
      contextMenuProps={contextMenuProps}
      preview={preview}
      previewStatus={previewStatus}
      layout={layout}
      onCheck={onCheck}
      selectedEpisodes={selectedEpisodes}
      renderPreviewContent={renderPreviewContent}
      onDoubleClick={ctrl.handleDoubleClick}
      newFilePaths={newFilePaths}
      checboxVisible={checboxVisible}
    />
  )
}
