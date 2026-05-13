import type {
  DownloadVideoBackgroundJob,
  ProcessBackgroundJob,
  SynthesizeBackgroundJob,
  TranscribeBackgroundJob,
  TranslateBackgroundJob,
} from '@/types/background-jobs'

const DB_NAME = 'DownloadTaskDatabase'
const DB_VERSION = 1
const STORE_NAME = 'jobs'

/** Persisted row in `DownloadTaskDatabase` / `jobs` (download-video, transcribe, etc.). */
export interface TaskJobRecord {
  id: string
  name: string
  status: string
  progress: number
  type: string
  folder: string
  data?: string
  createdAt: number
  updatedAt: number
}

/** @deprecated Use {@link TaskJobRecord} */
export type DownloadJobRecord = TaskJobRecord

export function openDownloadTaskDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getAllJobs(): Promise<TaskJobRecord[]> {
  const db = await openDownloadTaskDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

export async function putJob(job: TaskJobRecord): Promise<void> {
  const db = await openDownloadTaskDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(job)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function deleteJob(id: string): Promise<void> {
  const db = await openDownloadTaskDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

const ONE_HOUR_MS = 60 * 60 * 1000

export function isWithinOneHour(createdAt: number): boolean {
  return Date.now() - createdAt < ONE_HOUR_MS
}

export interface GetJobsByTypeAndFolderOptions {
  /** When true (default), omit records with status `succeeded`. */
  excludeSucceeded?: boolean
  /** When true (default), only include jobs created within the last hour. */
  withinOneHour?: boolean
}

export async function getJobsByTypeAndFolder(
  jobType: string,
  folder: string,
  options: GetJobsByTypeAndFolderOptions = {},
): Promise<TaskJobRecord[]> {
  const { excludeSucceeded = true, withinOneHour = true } = options
  const records = await getAllJobs()
  return records.filter((r) => {
    if (r.type !== jobType || r.folder !== folder) return false
    if (withinOneHour && !isWithinOneHour(r.createdAt)) return false
    if (excludeSucceeded && r.status === 'succeeded') return false
    return true
  })
}

export function notifyIndexedDbUpdated(): void {
  window.dispatchEvent(new CustomEvent('indexed-updated'))
}

export async function saveDownloadVideoJob(job: DownloadVideoBackgroundJob): Promise<void> {
  const now = Date.now()
  const record: TaskJobRecord = {
    id: job.id,
    name: job.name,
    status: job.status,
    progress: job.progress,
    type: job.type,
    folder: job.data.folder,
    data: JSON.stringify(job.data),
    createdAt: now,
    updatedAt: now,
  }
  await putJob(record)
  notifyIndexedDbUpdated()
}

export async function saveTranslateJob(job: TranslateBackgroundJob): Promise<void> {
  const now = Date.now()
  const record: TaskJobRecord = {
    id: job.id,
    name: job.name,
    status: job.status,
    progress: job.progress,
    type: job.type,
    folder: job.data.folder,
    data: JSON.stringify(job.data),
    createdAt: now,
    updatedAt: now,
  }
  await putJob(record)
  notifyIndexedDbUpdated()
}

export async function saveSynthesizeJob(job: SynthesizeBackgroundJob): Promise<void> {
  const now = Date.now()
  const record: TaskJobRecord = {
    id: job.id,
    name: job.name,
    status: job.status,
    progress: job.progress,
    type: job.type,
    folder: job.data.folder,
    data: JSON.stringify(job.data),
    createdAt: now,
    updatedAt: now,
  }
  await putJob(record)
  notifyIndexedDbUpdated()
}

export async function saveProcessJob(job: ProcessBackgroundJob): Promise<void> {
  const now = Date.now()
  const record: TaskJobRecord = {
    id: job.id,
    name: job.name,
    status: job.status,
    progress: job.progress,
    type: job.type,
    folder: job.data.folder,
    data: JSON.stringify(job.data),
    createdAt: now,
    updatedAt: now,
  }
  await putJob(record)
  notifyIndexedDbUpdated()
}

export async function saveTranscribeJob(job: TranscribeBackgroundJob): Promise<void> {
  const now = Date.now()
  const record: TaskJobRecord = {
    id: job.id,
    name: job.name,
    status: job.status,
    progress: job.progress,
    type: job.type,
    folder: job.data.folder,
    data: JSON.stringify(job.data),
    createdAt: now,
    updatedAt: now,
  }
  await putJob(record)
  notifyIndexedDbUpdated()
}
