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
