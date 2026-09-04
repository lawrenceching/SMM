import type { MetadataFiles } from "@smm/types/MetadataFiles"
import { useCallback, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "@/lib/i18n"
import type { EpisodeContextMenuItem } from "./MediaFileTableRow"
import { MediaFileTableDetailLayout } from "./MediaFileTableDetailLayout"
import { MediaFileTablePreviewLayout } from "./MediaFileTablePreviewLayout"
import { MediaFileTableSimpleLayout } from "./MediaFileTableSimpleLayout"

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

/**
 * Props controlling the right-click context menu on episode / data rows.
 *
 * `UIMediaFileTable` hardcodes all menu items internally and uses these props
 * to control visibility, disabled state, and click handlers for each item.
 */
export interface MediaFileTableContextMenuProps {
  /** Handler for "Open". Always visible when provided. */
  onOpenMenuClick?: (row: UIMediaFileDataRow) => void
  /** Handler for "Properties". Always visible when provided. */
  onPropertiesMenuClick?: (row: UIMediaFileDataRow) => void

  /** Show "Rename" menu item. */
  renameMenuVisible?: boolean
  /** Disabled state for "Rename". Defaults to `!row.videoFile` when omitted. */
  renameMenuDisabled?: boolean
  /** Handler for "Rename". */
  onRenameMenuClick?: (row: UIMediaFileDataRow) => void

  /** Show "Select File" menu item. */
  selectFileMenuVisible?: boolean
  /** Disabled state for "Select File". Defaults to `false` when omitted. */
  selectFileMenuDisabled?: boolean
  /** Handler for "Select File". */
  onSelectFileMenuClick?: (row: UIMediaFileDataRow) => void

  /** Show "Unlink" menu item. */
  unlinkMenuVisible?: boolean
  /** Disabled state for "Unlink". Defaults to `!row.videoFile` when omitted. */
  unlinkMenuDisabled?: boolean
  /** Handler for "Unlink". */
  onUnlinkMenuClick?: (row: UIMediaFileDataRow) => void

  /** Show "Video Compress" menu item. */
  videoCompressMenuVisible?: boolean
  /** Disabled state for "Video Compress". Defaults to `!row.videoFile` when omitted. */
  videoCompressMenuDisabled?: boolean
  /** Handler for "Video Compress". */
  onVideoCompressMenuClick?: (row: UIMediaFileDataRow) => void

  /** Show "Format Convert" menu item. */
  formatConvertMenuVisible?: boolean
  /** Disabled state for "Format Convert". Defaults to `!row.videoFile` when omitted. */
  formatConvertMenuDisabled?: boolean
  /** Handler for "Format Convert". */
  onFormatConvertMenuClick?: (row: UIMediaFileDataRow) => void
}

// ========================================================================
// Component props
// ========================================================================

export interface UIMediaFileTableProps {
  seasonData?: MediaFileTableSeasonData[],
  metadataFiles?: MetadataFiles,
  subtitleFiles?: { season: number, episode: number, files: string[] }[],
  nfoFiles?: { season: number, episode: number, files: string[] }[],
  thumbnailFiles?: { season: number, episode: number, files: string[] }[],
  data: UIMediaFileTableRow[]
  /** When set, paths are shown relative to this base. */
  mediaFolderPath?: string
  /** Right-click menu configuration. Omit for no row context menus. */
  contextMenuConfig?: UIMediaFileTableContextMenuConfig
  /**
   * Right-click context menu props. When provided, `UIMediaFileTable` hardcodes
   * the menu items and uses these props to control visibility / disabled / callbacks.
   * Takes precedence over `contextMenuConfig` for data-row items.
   */
  contextMenuProps?: MediaFileTableContextMenuProps
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
  onCheck?: (season: number, episode: number, checked: boolean) => void
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
  newFilePaths?: { season: number, episode: number, newFilePath: string }[]
  checboxVisible?: boolean
  /**
   * When `true` (default), episodes without a video file (`MediaFileTableEpisodeData.path`
   * is undefined) render their checkbox as disabled.
   */
  disableCheckboxIfEpisodeVideoNotAvailable?: boolean
}

// ========================================================================
// Shared layout-independent table state
// ========================================================================

/**
 * State owned by the `UIMediaFileTable` dispatcher and shared with the
 * per-layout presentational components (kept outside them so switching layout
 * does not remount the state).
 */
export interface MediaFileTableLayoutState {
  /** Divider ids currently collapsed. */
  collapsedIds: Set<string>
  /** Toggle a divider section's collapsed state. */
  setSectionCollapsed: (dividerId: string, collapsed: boolean) => void
  /** Context-menu items forwarded to every episode row. */
  episodeContextMenuItems: EpisodeContextMenuItem[]
}

type Translator = (key: string, options?: Record<string, unknown>) => string

/** Build the effective context-menu config from `contextMenuProps` (which takes
 * precedence over the raw `contextMenuConfig` for data-row items). */
function buildEffectiveContextMenuConfig(
  contextMenuProps: MediaFileTableContextMenuProps | undefined,
  contextMenuConfig: UIMediaFileTableContextMenuConfig | undefined,
  t: Translator,
): UIMediaFileTableContextMenuConfig | undefined {
  if (contextMenuProps) {
    const { onOpenMenuClick, onPropertiesMenuClick } = contextMenuProps
    const dataRowItems: UIMediaFileDataContextMenuItem[] = [
      {
        id: "open",
        label: t("mediaFileTable.contextMenu.open"),
        onClick: onOpenMenuClick,
        disabled: (row) => !row.videoFile,
      },
      {
        id: "properties",
        label: t("mediaFileTable.contextMenu.properties"),
        onClick: onPropertiesMenuClick,
        disabled: (row) => !row.videoFile,
      },
    ]

    if (contextMenuProps.renameMenuVisible !== false && contextMenuProps.onRenameMenuClick) {
      dataRowItems.push({
        id: "rename",
        label: t("episodeFile.rename"),
        onClick: contextMenuProps.onRenameMenuClick,
        disabled: (row) => contextMenuProps.renameMenuDisabled ?? !row.videoFile,
      })
    }
    if (contextMenuProps.selectFileMenuVisible !== false && contextMenuProps.onSelectFileMenuClick) {
      dataRowItems.push({
        id: "select-file",
        label: t("episodeFile.selectFile"),
        onClick: contextMenuProps.onSelectFileMenuClick,
        disabled: contextMenuProps.selectFileMenuDisabled,
      })
    }
    if (contextMenuProps.unlinkMenuVisible !== false && contextMenuProps.onUnlinkMenuClick) {
      dataRowItems.push({
        id: "unlink",
        label: t("tvShowEpisodeTable.contextMenu.unlink"),
        onClick: contextMenuProps.onUnlinkMenuClick,
        disabled: (row) => contextMenuProps.unlinkMenuDisabled ?? !row.videoFile,
      })
    }
    if (contextMenuProps.videoCompressMenuVisible !== false && contextMenuProps.onVideoCompressMenuClick) {
      dataRowItems.push({
        id: "video-compress",
        label: t("tvShowEpisodeTable.contextMenu.videoCompress"),
        onClick: contextMenuProps.onVideoCompressMenuClick,
        disabled: (row) => contextMenuProps.videoCompressMenuDisabled ?? !row.videoFile,
      })
    }
    if (contextMenuProps.formatConvertMenuVisible !== false && contextMenuProps.onFormatConvertMenuClick) {
      dataRowItems.push({
        id: "format-convert",
        label: t("tvShowEpisodeTable.contextMenu.formatConvert"),
        onClick: contextMenuProps.onFormatConvertMenuClick,
        disabled: (row) => contextMenuProps.formatConvertMenuDisabled ?? !row.videoFile,
      })
    }

    const folderFileRowItems: UIMediaFileFolderContextMenuItem[] = [
      {
        id: "open",
        label: t("mediaFileTable.contextMenu.open"),
        onClick: onOpenMenuClick
          ? (row) => (onOpenMenuClick as unknown as (row: UIMediaFileFolderRow) => void)(row)
          : undefined,
        disabled: (row) => !row.path,
      },
    ]

    return { dataRowItems, folderFileRowItems }
  }

  return contextMenuConfig
}

// ========================================================================
// Main component (dispatcher)
// ========================================================================

/**
 * Dispatches to a per-layout presentational component (`simple` / `detail` /
 * `preview`). Owns the layout-independent table state (season collapse,
 * context-menu items) so it survives layout switches.
 *
 * A rename preview (`newFilePaths` non-empty) always renders the `simple`
 * layout, since only that layout supports reviewing old→new file paths.
 */
export function UIMediaFileTable(props: UIMediaFileTableProps) {
  const { layout = "simple", newFilePaths, contextMenuProps, contextMenuConfig } = props
  const { t } = useTranslation("components")
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  const setSectionCollapsed = useCallback((dividerId: string, collapsed: boolean) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (collapsed) next.add(dividerId)
      else next.delete(dividerId)
      return next
    })
  }, [])

  const effectiveContextMenuConfig = useMemo(
    () => buildEffectiveContextMenuConfig(contextMenuProps, contextMenuConfig, t as Translator),
    [contextMenuProps, contextMenuConfig, t],
  )

  // Context menu items for the seasonData-driven episode rows. Built once per
  // config from the (deprecated) UIMediaFileDataRow-based `dataRowItems`.
  const episodeContextMenuItems = useMemo(
    () => buildEpisodeContextMenuItems(effectiveContextMenuConfig),
    [effectiveContextMenuConfig],
  )

  const tableState: MediaFileTableLayoutState = {
    collapsedIds,
    setSectionCollapsed,
    episodeContextMenuItems,
  }

  const effectiveLayout = (newFilePaths?.length ?? 0) > 0 ? "simple" : layout

  if (effectiveLayout === "detail") {
    return <MediaFileTableDetailLayout {...props} tableState={tableState} />
  }
  if (effectiveLayout === "preview") {
    return <MediaFileTablePreviewLayout {...props} tableState={tableState} />
  }
  return <MediaFileTableSimpleLayout {...props} tableState={tableState} />
}

// ========================================================================
// Season / episode content blocks (moved to MediaFileTableBlocks)
// ========================================================================

export {
  UIMediaFileTableSeasonBlock,
  UIMediaFileTableEpisodeBlock,
  UIMediaFileTableEpisodeDetailBlock,
  UIMediaFileTableEpisodePreviewBlock,
  type UIMediaFileTableEpisodeBlockProps,
} from "./MediaFileTableBlocks"

export {
  MediaFileTableSimpleLayout,
  type MediaFileTableSimpleLayoutProps,
} from "./MediaFileTableSimpleLayout"
export {
  MediaFileTableDetailLayout,
  type MediaFileTableDetailLayoutProps,
} from "./MediaFileTableDetailLayout"
export {
  MediaFileTablePreviewLayout,
  type MediaFileTablePreviewLayoutProps,
} from "./MediaFileTablePreviewLayout"

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
