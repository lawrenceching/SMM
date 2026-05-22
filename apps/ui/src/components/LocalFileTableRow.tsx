import type { LocalFileTableRowData } from "./MusicFileTable"
import { useLocalFileSubtitle } from "./LocalFileSubtitleScope"
import {
  UILocalFileTableRow,
  type LocalFileTableRowFileMenu,
  type MusicTableSelection,
} from "./UILocalFileTableRow"

export type { LocalFileTableRowData } from "./MusicFileTable"
export type { MusicTableSelection, LocalFileTableRowFileMenu } from "./UILocalFileTableRow"

export interface LocalFileTableRowProps {
  row: LocalFileTableRowData
  mediaFolderPath?: string
  selection: MusicTableSelection
  fileMenu: LocalFileTableRowFileMenu
  onTrackClick?: (trackId: number) => void
}

export function LocalFileTableRow({
  row,
  mediaFolderPath,
  selection,
  fileMenu,
  onTrackClick,
}: LocalFileTableRowProps) {
  const subtitle = useLocalFileSubtitle()
  const isSelected = selection.selectedTrackIds.includes(row.id)
  const subtitleUi = subtitle.getRowSubtitleUi(
    row,
    selection.isMultiSelectMode,
    isSelected,
  )
  const subtitleActions = subtitle.bindRowActions(row)

  return (
    <UILocalFileTableRow
      row={row}
      mediaFolderPath={mediaFolderPath}
      isSelected={isSelected}
      selection={selection}
      subtitleUi={subtitleUi}
      subtitleActions={subtitleActions}
      fileMenu={fileMenu}
      onTrackClick={onTrackClick}
    />
  )
}
