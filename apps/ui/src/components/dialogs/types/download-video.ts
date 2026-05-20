import type { FileItem } from "./common"

export interface DownloadVideoDialogProps {
  isOpen: boolean
  onClose: () => void
  onOpenFilePicker: (
    onSelect: (file: FileItem) => void,
    options?: { selectFolder?: boolean; initialPath?: string },
  ) => void
  /** The absolute path in platform-specific format */
  destinationFolder?: string
}

export interface EpisodeItem {
  title: string
  artist: string
  /** Stable id for selection; same as the download URL. */
  url: string
}
