import type { Core, FolderType, ImportLibraryJob } from 'core-app'
import { createAddProgressState, emitAddProgress } from './addProgress'

export async function waitUntilLibraryImportSettled(
  core: Core,
  id: string,
  options: {
    libraryPath: string
    type: FolderType
    timeoutMs: number
    log?: (line: string) => void
    /** When false, do not print progress lines. Default true. */
    progress?: boolean
    skipInit?: boolean
  },
): Promise<ImportLibraryJob> {
  const log = options.log ?? console.log
  const emitProgress = options.progress !== false
  let announcedLibrary = false
  let lastImportJobId: string | undefined
  let folderProgress = createAddProgressState()
  const deadline = Date.now() + options.timeoutMs

  for (;;) {
    const job = core.getJob(id)
    if (job?.kind === 'import-library') {
      if (
        !announcedLibrary &&
        (job.tasks.length > 0 || (job.status !== 'running' && job.status !== 'pending'))
      ) {
        log(`importing library ${options.libraryPath} (${job.tasks.length} folders)`)
        announcedLibrary = true
      }

      const runningTask = job.tasks.find((task) => task.status === 'running')
      if (runningTask?.importJobId && runningTask.importJobId !== lastImportJobId) {
        lastImportJobId = runningTask.importJobId
        folderProgress = createAddProgressState()
      }

      if (
        emitProgress &&
        !options.skipInit &&
        lastImportJobId &&
        runningTask
      ) {
        const childJob = core.getJob(lastImportJobId)
        if (childJob?.kind === 'import') {
          folderProgress = emitAddProgress(
            folderProgress,
            childJob,
            runningTask.path,
            options.type,
            log,
          )
        }
      }

      if (job.status !== 'pending' && job.status !== 'running') {
        if (emitProgress && job.status === 'succeeded' && !options.skipInit) {
          log('succeeded')
        }
        return job
      }
    }

    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for import library job ${id}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}
