import { apiFetch } from '@/lib/apiFetch'
import type {
  ImportLibraryJob as ImportLibraryJobBody,
} from '@smm/types/job/ImportLibraryJob'
import type { ScrapeTaskId } from '@/lib/scrapeDialog'

export type { ImportLibraryJobTask } from '@smm/types/job/ImportLibraryJob'

export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'aborted'

export type ScrapeTaskRuntimeStatus =
  | 'pending'
  | 'running'
  | 'skipped'
  | 'completed'
  | 'failed'

export interface ScrapeJobTask {
  status: ScrapeTaskRuntimeStatus
  error?: string
}

export interface ScrapeJob {
  kind: 'scrape'
  id: string
  folderPath: string
  status: JobStatus
  tasks: Record<ScrapeTaskId, ScrapeJobTask>
  error?: string
  createdAt: number
  updatedAt: number
}

export interface ImportJob {
  kind: 'import'
  id: string
  folderPath: string
  type: string
  status: JobStatus
  stage: string | null
  progress: number
  recognizedTitle?: string
  error?: string
  createdAt: number
  updatedAt: number
}

export interface ImportLibraryJob extends ImportLibraryJobBody {
  kind: 'import-library'
}

export type Job = ImportJob | ImportLibraryJob | ScrapeJob

export interface GetJobResponseBody {
  data?: Job
  error?: string
}

/** Poll Core job (`POST /api/get-job`). */
export async function getJob(id: string, signal?: AbortSignal): Promise<GetJobResponseBody> {
  const resp = await apiFetch('/api/get-job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`)
  }

  return (await resp.json()) as GetJobResponseBody
}

/** Throws on business error; returns job. */
export async function getJobViaCore(id: string, signal?: AbortSignal): Promise<Job> {
  const body = await getJob(id, signal)
  if (body.error) {
    throw new Error(body.error)
  }
  if (!body.data) {
    throw new Error('Error Reason: Job not found')
  }
  return body.data
}
