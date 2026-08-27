import { Path } from '@core/path'
import { getFolders } from '@/api/getFolders'
import { getJobViaCore, type ImportLibraryJob, type ImportLibraryJobTask } from '@/api/getJob'
import { showFolderViaCore } from '@/api/showFolder'
import type { UIMediaFolder, UIMediaFolderStatus } from '@/types/UIMediaFolder'
import type { FolderType } from '@core/types'
import { importLibraryLog, type ImportLibraryTrace } from '@/lib/importLibraryLog'

const POLL_INTERVAL_MS = 1000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function folderTypeToMediaType(type: FolderType): NonNullable<UIMediaFolder['type']> {
  if (type === 'tvshow') return 'tvshow-folder'
  if (type === 'movie') return 'movie-folder'
  return 'music-folder'
}

export function importLibraryTaskStatusToUiStatus(
  status: ImportLibraryJobTask['status'],
): UIMediaFolderStatus {
  switch (status) {
    case 'pending':
      return 'pending_for_initialization'
    case 'running':
      return 'initializing'
    case 'succeeded':
      return 'ok'
    case 'failed':
      return 'error_loading_metadata'
  }
}

export function syncSidebarFromImportLibraryJob(
  job: ImportLibraryJob,
  upsertFolder: (folder: UIMediaFolder) => void,
  mediaType: NonNullable<UIMediaFolder['type']>,
): void {
  for (const task of job.tasks) {
    upsertFolder({
      path: task.path,
      status: importLibraryTaskStatusToUiStatus(task.status),
      type: mediaType,
    })
  }
}

function importLibraryTaskPaths(job: ImportLibraryJob): string[] {
  return job.tasks.map((task) => task.path)
}

function foldersContainAll(folderPaths: string[], registered: string[]): boolean {
  const registeredPosix = new Set(registered.map((p) => Path.posix(p)))
  return folderPaths.every((p) => registeredPosix.has(Path.posix(p)))
}

async function foldersRegisteredInUserConfig(
  folderPaths: string[],
  signal?: AbortSignal,
): Promise<boolean> {
  const resp = await getFolders(signal)
  if (resp.error) {
    throw new Error(resp.error)
  }
  const folders = resp.data?.folders ?? []
  return foldersContainAll(folderPaths, folders)
}

/**
 * Waits until Core has finished Loop #1 (blank metadata + batch UserConfig upsert).
 * Returns folder paths from the import-library job tasks.
 */
export async function waitForLibraryFoldersRegistered(
  coreJobId: string,
  trace?: ImportLibraryTrace,
  signal?: AbortSignal,
): Promise<string[]> {
  importLibraryLog(trace, 'wait for folder registration started', { coreJobId })
  let loggedWaitingForUserConfig = false

  for (;;) {
    const job = await getJobViaCore(coreJobId, signal)
    if (job.kind !== 'import-library') {
      throw new Error(`Error Reason: unexpected job kind: ${job.kind}`)
    }

    const folderPaths = importLibraryTaskPaths(job)

    if (job.status === 'failed') {
      importLibraryLog(trace, 'folder registration skipped (job ended early)', {
        coreJobId,
        status: job.status,
        folderPaths,
        error: job.error,
      })
      return folderPaths
    }

    if (folderPaths.length > 0) {
      const registered = await foldersRegisteredInUserConfig(folderPaths, signal)
      if (registered) {
        importLibraryLog(trace, 'folder registration ready', {
          coreJobId,
          folderCount: folderPaths.length,
          folderPaths,
        })
        return folderPaths
      }
      if (!loggedWaitingForUserConfig) {
        importLibraryLog(trace, 'waiting for UserConfig folders after Core prep', {
          coreJobId,
          folderPaths,
        })
        loggedWaitingForUserConfig = true
      }
    } else if (job.status === 'succeeded') {
      importLibraryLog(trace, 'folder registration ready (empty library)', { coreJobId })
      return folderPaths
    }

    await sleep(POLL_INTERVAL_MS)
  }
}

export async function pollImportLibraryJob(
  jobId: string,
  onUpdate: (job: ImportLibraryJob) => void,
  trace?: ImportLibraryTrace,
  signal?: AbortSignal,
): Promise<ImportLibraryJob> {
  importLibraryLog(trace, 'poll import-library job started', { coreJobId: jobId })
  let lastLoggedProgress = -1
  let lastLoggedStatus = ''

  for (;;) {
    const job = await getJobViaCore(jobId, signal)
    if (job.kind !== 'import-library') {
      throw new Error(`Error Reason: unexpected job kind: ${job.kind}`)
    }

    if (job.progress !== lastLoggedProgress || job.status !== lastLoggedStatus) {
      importLibraryLog(trace, 'poll import-library job status', {
        coreJobId: jobId,
        status: job.status,
        progress: job.progress,
        taskCount: job.tasks.length,
        tasks: job.tasks.map((task) => ({ path: task.path, status: task.status })),
      })
      lastLoggedProgress = job.progress
      lastLoggedStatus = job.status
    }

    onUpdate(job)
    if (job.status === 'succeeded' || job.status === 'failed') {
      importLibraryLog(trace, 'poll import-library job finished', {
        coreJobId: jobId,
        status: job.status,
        progress: job.progress,
        error: job.error,
      })
      return job
    }
    await sleep(POLL_INTERVAL_MS)
  }
}

export async function buildUiFoldersFromShowFolder(
  paths: string[],
  trace?: ImportLibraryTrace,
): Promise<UIMediaFolder[]> {
  importLibraryLog(trace, 'resolve folder display status', { folderCount: paths.length })
  const folders: UIMediaFolder[] = []
  for (const path of paths) {
    const show = await showFolderViaCore(path)
    folders.push({
      path: show.path,
      status: show.status,
      ...(show.type !== undefined ? { type: show.type } : {}),
    })
  }
  return folders
}
