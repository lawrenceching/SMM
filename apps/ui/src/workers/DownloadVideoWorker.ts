import {
  deriveDownloadVideoJobStatus,
  recomputeDownloadVideoJobProgress,
} from '@/lib/downloadVideoJobFactory'
import { YTDLP_DOWNLOAD_DEFAULT_ARGS } from '@/lib/ytdlpDownloadDefaultArgs'
import { useBackgroundJobsStore } from '@/stores/backgroundJobsStore'
import {
  isDownloadVideoJob,
  type DownloadVideoBackgroundJob,
  type DownloadVideoItemStatus,
} from '@/types/background-jobs'
import {
  UI_DownloadVideoJobFolderRefreshEvent,
  type OnDownloadVideoJobFolderRefreshEventData,
} from '@/types/eventTypes'

let downloadVideoWorker: Worker | null = null

function getDownloadVideoWorker(): Worker {
  if (downloadVideoWorker) {
    return downloadVideoWorker
  }
  const worker = new Worker(new URL('./downloadVideo.worker.ts', import.meta.url), {
    type: 'module',
  })
  downloadVideoWorker = worker
  return worker
}

function patchDownloadVideoJob(
  jobId: string,
  updater: (job: DownloadVideoBackgroundJob) => DownloadVideoBackgroundJob
): void {
  useBackgroundJobsStore.getState().patchJob(jobId, (job) => {
    if (!isDownloadVideoJob(job)) return job
    const next = updater(job)
    return {
      ...next,
      progress: recomputeDownloadVideoJobProgress(next.data),
      status: deriveDownloadVideoJobStatus(next.data),
    }
  })
}

function dispatchFolderRefresh(folder: string): void {
  document.dispatchEvent(
    new CustomEvent<OnDownloadVideoJobFolderRefreshEventData>(
      UI_DownloadVideoJobFolderRefreshEvent,
      { detail: { folder } }
    )
  )
}

/**
 * Apply messages from the download Web Worker or the in-page fallback orchestrator.
 */
export function handleDownloadVideoSwMessage(data: unknown): void {
  if (!data || typeof data !== 'object' || !('type' in data)) {
    return
  }
  const m = data as {
    type: string
    jobId?: string
    index?: number
    status?: DownloadVideoItemStatus
    path?: string
    error?: string
  }
  if (!m.jobId) {
    return
  }

  switch (m.type) {
    case 'download-video/progress':
      patchDownloadVideoJob(m.jobId, (j) => ({
        ...j,
        data: {
          ...j.data,
          videos: j.data.videos.map((it, idx) =>
            idx === m.index ? { ...it, status: 'downloading' } : it
          ),
        },
      }))
      break

    case 'download-video/item-done': {
      const st = m.status
      if (st !== 'succeeded' && st !== 'failed') {
        break
      }
      patchDownloadVideoJob(m.jobId, (j) => ({
        ...j,
        data: {
          ...j.data,
          videos: j.data.videos.map((it, idx) =>
            idx === m.index ? { ...it, status: st } : it
          ),
        },
      }))
      if (st === 'succeeded') {
        const job = useBackgroundJobsStore
          .getState()
          .jobs.find((x) => x.id === m.jobId && isDownloadVideoJob(x))
        if (job) {
          dispatchFolderRefresh(job.data.folder)
        }
      }
      break
    }

    case 'download-video/job-done':
      break

    default:
      break
  }
}

/**
 * Subscribes worker → main-thread messages to `handleDownloadVideoSwMessage`.
 * Call once from `DownloadVideoMessageHandler` (app root). Returns cleanup for StrictMode / unmount.
 */
export function registerDownloadVideoWorkerMessageHandler(): () => void {
  if (typeof Worker === 'undefined') {
    return () => {}
  }
  let worker: Worker
  try {
    worker = getDownloadVideoWorker()
  } catch (e) {
    console.warn('[download-video-worker] init failed', e)
    return () => {}
  }
  const onMessage = (event: MessageEvent<unknown>) => {
    handleDownloadVideoSwMessage(event.data)
  }
  worker.addEventListener('message', onMessage)
  return () => worker.removeEventListener('message', onMessage)
}

async function orchestrateDownloadVideoJobInPage(jobId: string): Promise<void> {
  const job = useBackgroundJobsStore.getState().jobs.find((j) => j.id === jobId && isDownloadVideoJob(j))
  if (!job) {
    return
  }
  const { folder } = job.data
  const urls = job.data.videos.map((v) => v.url)

  for (let i = 0; i < urls.length; i++) {
    handleDownloadVideoSwMessage({ type: 'download-video/progress', jobId, index: i })
    let body: { error?: string; success?: boolean; path?: string }
    try {
      const res = await fetch('/api/ytdlp/download', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urls[i], folder, args: YTDLP_DOWNLOAD_DEFAULT_ARGS }),
      })
      body = (await res.json()) as { error?: string; success?: boolean; path?: string }
    } catch (e) {
      body = { error: e instanceof Error ? e.message : String(e) }
    }
    if (body.error) {
      handleDownloadVideoSwMessage({
        type: 'download-video/item-done',
        jobId,
        index: i,
        status: 'failed',
        error: body.error,
      })
    } else {
      handleDownloadVideoSwMessage({
        type: 'download-video/item-done',
        jobId,
        index: i,
        status: 'succeeded',
        path: body.path,
      })
    }
  }
  handleDownloadVideoSwMessage({ type: 'download-video/job-done', jobId })
}

/**
 * Starts a persisted download-video job: Dedicated Web Worker when available, otherwise in-page.
 */
export async function startDownloadVideoJob(jobId: string): Promise<void> {
  const job = useBackgroundJobsStore.getState().jobs.find((j) => j.id === jobId && isDownloadVideoJob(j))
  if (!job) {
    return
  }

  const urls = job.data.videos.map((v) => v.url)

  if (typeof Worker !== 'undefined') {
    try {
      const worker = getDownloadVideoWorker()
      worker.postMessage({
        type: 'download-video/run',
        payload: {
          jobId,
          folder: job.data.folder,
          urls,
        },
      })
      return
    } catch (e) {
      console.warn('[download-video-worker] postMessage failed, falling back to main thread', e)
    }
  }

  await orchestrateDownloadVideoJobInPage(jobId)
}
