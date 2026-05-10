import type { ReactNode } from "react"

export interface DialogConfig {
  title?: string
  description?: string
  content?: ReactNode
  onClose?: () => void
  showCloseButton?: boolean
  className?: string
}

export type FolderType = "tvshow" | "movie" | "music"

export interface FileItem {
  name: string
  path: string
  isDirectory?: boolean
  size?: number
  mtime?: number
}

export interface ConfirmationDialogProps {
  isOpen: boolean
  config: DialogConfig | null
  onClose: () => void
}

export interface SpinnerDialogProps {
  isOpen: boolean
  message?: string
}

import type { SettingsTab } from "@/components/ui/config-panel"

export interface ConfigDialogProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: SettingsTab
}

export interface FilePickerDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (file: FileItem) => void
  title?: string
  description?: string
  hideDialogHeader?: boolean
  selectFolder?: boolean
  initialPath?: string
}

export interface DownloadVideoDialogProps {
  isOpen: boolean
  onClose: () => void
  onOpenFilePicker: (
    onSelect: (file: FileItem) => void,
    options?: { selectFolder?: boolean; initialPath?: string }
  ) => void
  /**
   * The absolute path in platform-specific format
   */
  destinationFolder?: string
}

export interface MediaSearchDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect?: (tmdbId: number) => void
}

export interface RenameFileDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (newName: string) => void | Promise<void>
  initialValue?: string
  title?: string
  description?: string
  suggestions?: string[]
}

export interface RenameFolderDialogProps {
  isOpen: boolean
  onClose: () => void
  mediaFolderPath: string
  title?: string
  description?: string
}

export interface OpenFolderDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (type: FolderType) => void
  folderPath?: string
}

export interface DeleteTrackDialogProps {
  trackTitle: string
  onConfirm: () => void
  onCancel: () => void
}

export interface Task {
  name: string
  status: "pending" | "running" | "completed" | "failed"
  subTasks?: Task[]
}

import type { MediaMetadata } from "@core/types"

export interface ScrapeDialogProps {
  isOpen: boolean
  onClose: () => void
  mediaMetadata?: MediaMetadata
}

export type TranscribeRowStatus = "pending" | "running" | "completed" | "failed"

/** Values passed to VideoCaptioner `transcribe --asr` from TranscribeDialog. */
export type TranscribeAsrEngine = "bijian" | "jianying" | "whisper-cpp"

export interface TranscribeDialogRow {
  id: string
  /** POSIX absolute path (passed to transcribe API). */
  path: string
  /** Shown in the file column when set; defaults to `path`. */
  displayPath?: string
  status: TranscribeRowStatus
  /** Used for job labels and toasts; falls back to basename of path in TranscribeDialog. */
  title?: string
}

export interface UITranscribeDialogProps {
  isOpen: boolean
  onClose: () => void
  rows: TranscribeDialogRow[]
  title?: string
  description?: string
  /** When omitted, all rows are selected when the dialog opens. */
  defaultSelectedIds?: string[]
  /**
   * When true, show ASR engine selection (VideoCaptioner). When false, transcription uses the default engine (omit `asr` on API).
   */
  asrOptionsEnabled?: boolean
  /** Engines listed in the selector but not selectable. */
  disabledAsrEngines?: readonly TranscribeAsrEngine[]
  onConfirm?: (payload: {
    selectedIds: string[]
    asr: TranscribeAsrEngine
  }) => void | Promise<void>
}

/** Smart dialog: confirm runs transcribe via background jobs (no external onConfirm). */
export type TranscribeDialogProps = Omit<UITranscribeDialogProps, "onConfirm">

export interface TrackProperties {
  id: number
  title?: string
  artist?: string
  duration?: number
  thumbnail?: string
  addedDate?: Date
  filePath?: string
  path?: string
}

export interface FilePropertyDialogProps {
  isOpen: boolean
  onClose: () => void
  track: TrackProperties
}

export interface FormatConverterDialogProps {
  isOpen: boolean
  onClose: () => void
  track?: TrackProperties
  onOpenFilePicker?: (
    onSelect: (file: FileItem) => void,
    options?: { selectFolder?: boolean; initialPath?: string }
  ) => void
  onSelectSource?: (track: TrackProperties) => void
}

/** Options passed when opening the edit media file (tags) dialog. Path is the media file path (e.g. POSIX). */
export interface OpenEditMediaFileOptions {
  path: string
}

export interface EditMediaFileDialogProps {
  isOpen: boolean
  onClose: () => void
  /** Media file path (e.g. POSIX) to read/write tags. */
  path: string | undefined
}

export type ExecuteCmdType = 'ffmpeg' | 'ffprobe' | 'yt-dlp' | 'videocaptioner'

export interface ExecuteCmdDialogProps {
  isOpen: boolean
  onClose: () => void
  initialCommand?: ExecuteCmdType
}

export interface ExecuteCmdLogEntry {
  id: number
  timestamp: number
  type: 'stdout' | 'stderr' | 'system'
  content: string
}

