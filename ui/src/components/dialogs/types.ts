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

export interface ConfigDialogProps {
  isOpen: boolean
  onClose: () => void
}

export interface FilePickerDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (file: FileItem) => void
  title?: string
  description?: string
}

export interface DownloadVideoDialogProps {
  isOpen: boolean
  onClose: () => void
  onStart: (url: string, downloadFolder: string) => void
  onOpenFilePicker: (onSelect: (file: FileItem) => void) => void
}

export interface MediaSearchDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect?: (tmdbId: number) => void
}

export interface RenameDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (newName: string) => void
  initialValue?: string
  title?: string
  description?: string
  suggestions?: string[]
}

export interface OpenFolderDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (type: FolderType) => void
  folderPath?: string
}

export interface Task {
  name: string
  status: "pending" | "running" | "completed" | "failed"
  subTasks?: Task[]
}

export interface TaskProgressDialogProps {
  isOpen: boolean
  onClose: () => void
  tasks: Task[]
  title?: string
  description?: string
  onStart?: () => void
}

