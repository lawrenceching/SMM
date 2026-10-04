export interface ImportLibraryJobTask {
  id: string
  /**
   * Media folder path
   */
  path: string
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  /** Active child import-folder job id while status is running. */
  importJobId?: string
}

export interface ImportLibraryJob {
  id: string
  libraryPath: string
  /** Job type (`AbstractJob.type`), not media-folder type. */
  type: 'import-library'
  folderType: 'music' | 'tvshow' | 'movie'
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  createdAt: number
  updatedAt: number
  /**
   * The progress of the job, from 0 to 100
   */
  progress: number
  tasks: ImportLibraryJobTask[]
  error?: string
}
