export interface RenameFileEntry {
  /**
   * Absolute path of the source file in POSIX format
   */
  from: string
  /**
   * Absolute path of the destination file in POSIX format
   */
  to: string
}

export interface RenameFilesPlan {
  /**
   * UUID of the plan
   */
  id: string
  task: 'rename-files'
  status: 'pending' | 'completed' | 'rejected'
  /**
   * Absolute path of the media folder in POSIX format
   */
  mediaFolderPath: string
  files: RenameFileEntry[]
}
