import { getJobViaCore, type ImportLibraryJob } from '@/api/getJob'
import { showFolderViaCore } from '@/api/showFolder'
import type { UIMediaFolder } from '@/types/UIMediaFolder'
import type { FolderType } from '@core/types'

const POLL_INTERVAL_MS = 1000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function folderTypeToMediaType(type: FolderType): NonNullable<UIMediaFolder['type']> {
  if (type === 'tvshow') return 'tvshow-folder'
  if (type === 'movie') return 'movie-folder'
  return 'music-folder'
}

export async function pollImportLibraryJob(
  jobId: string,
  onUpdate: (job: ImportLibraryJob) => void,
  signal?: AbortSignal,
): Promise<ImportLibraryJob> {
  for (;;) {
    const job = await getJobViaCore(jobId, signal)
    if (job.kind !== 'import-library') {
      throw new Error(`Error Reason: unexpected job kind: ${job.kind}`)
    }
    onUpdate(job)
    if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'aborted') {
      return job
    }
    await sleep(POLL_INTERVAL_MS)
  }
}

export async function buildUiFoldersFromShowFolder(paths: string[]): Promise<UIMediaFolder[]> {
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
