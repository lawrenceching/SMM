export interface MusicTableSelection {
  isMultiSelectMode: boolean
  selectedTrackIds: number[]
  onSelectedTrackIdsChange?: (ids: number[]) => void
}

export interface LocalFileTableRowFileMenu {
  onOpen: () => void
  onDelete: () => void
  onProperties: () => void
  onFormatConvert: () => void
  onEditTags: () => void
}

export interface LocalFileTableRowSubtitleActions {
  onTranscribe: () => void
  onTranscribeStop: () => void
  onTranslate: () => void
  onTranslateStop: () => void
  onSynthesize: () => void
  onSynthesizeStop: () => void
  onProcess: () => void
  onProcessStop: () => void
}
