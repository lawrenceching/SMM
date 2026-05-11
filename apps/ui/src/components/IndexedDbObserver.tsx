import { useEffect } from 'react'
import { useBackgroundJobsStore } from '@/stores/backgroundJobsStore'
import {
  isDownloadVideoJob,
  isTranscribeBackgroundJob,
  type BackgroundJob,
  type DownloadVideoBackgroundJob,
  type DownloadVideoBackgroundJobData,
  type TranscribeBackgroundJob,
  type TranscribeBackgroundJobData,
} from '@/types/background-jobs'
import { getAllJobs, putJob, isWithinOneHour, type TaskJobRecord } from '@/lib/downloadTaskDb'

function jobRecordToBackgroundJob(record: TaskJobRecord): BackgroundJob | null {
  if (record.type === 'transcribe') {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(record.data || '{}') as Record<string, unknown>
    } catch {
      parsed = {}
    }
    const mediaPath = typeof parsed.mediaPath === 'string' ? parsed.mediaPath : ''
    const mediaPathPlatform =
      typeof parsed.mediaPathPlatform === 'string' ? parsed.mediaPathPlatform : mediaPath
    const provider: TranscribeBackgroundJobData['provider'] =
      parsed.provider === 'tencentAsr' ? 'tencentAsr' : 'videoCaptioner'
    const data: TranscribeBackgroundJobData = {
      folder: (typeof parsed.folder === 'string' ? parsed.folder : record.folder) || '',
      mediaPath,
      mediaPathPlatform,
      title: typeof parsed.title === 'string' ? parsed.title : record.name,
      provider,
    }
    if (provider === 'tencentAsr' && parsed.tencentAsr && typeof parsed.tencentAsr === 'object') {
      data.tencentAsr = parsed.tencentAsr as TranscribeBackgroundJobData['tencentAsr']
    }
    if (parsed.videoCaptioner && typeof parsed.videoCaptioner === 'object') {
      data.videoCaptioner = parsed.videoCaptioner as TranscribeBackgroundJobData['videoCaptioner']
    }
    const job: TranscribeBackgroundJob = {
      id: record.id,
      name: record.name,
      status: record.status as TranscribeBackgroundJob['status'],
      progress: record.progress,
      type: 'transcribe',
      data,
    }
    return job
  }

  if (record.type !== 'download-video') {
    return null
  }

  let data: DownloadVideoBackgroundJobData
  try {
    const parsed = JSON.parse(record.data || '{}')
    data = {
      folder: parsed.folder || record.folder || '',
      videos: parsed.videos || [],
    }
  } catch {
    data = {
      folder: record.folder || '',
      videos: [],
    }
  }

  const job: DownloadVideoBackgroundJob = {
    id: record.id,
    name: record.name,
    status: record.status as DownloadVideoBackgroundJob['status'],
    progress: record.progress,
    type: 'download-video',
    data,
  }
  return job
}

function isPersistedFromIdbJob(job: BackgroundJob): boolean {
  return isDownloadVideoJob(job) || isTranscribeBackgroundJob(job)
}

async function syncJobsToStore(): Promise<void> {
  const store = useBackgroundJobsStore.getState()
  const records = await getAllJobs()
  const storeJobIds = new Set(store.jobs.filter(isPersistedFromIdbJob).map((j) => j.id))
  const dbJobIds = new Set<string>()

  for (const record of records) {
    if (!isWithinOneHour(record.createdAt)) continue
    const job = jobRecordToBackgroundJob(record)
    if (!job) continue
    dbJobIds.add(job.id)

    if (storeJobIds.has(job.id)) {
      store.updateJob(job.id, job)
    } else {
      store.addJob(job)
    }
  }

  for (const id of storeJobIds) {
    if (!dbJobIds.has(id)) {
      store.removeJob(id)
    }
  }
}

async function startupSync(): Promise<void> {
  const records = await getAllJobs()

  for (const record of records) {
    if (record.status === 'running') {
      record.status = 'aborted'
      record.updatedAt = Date.now()
      await putJob(record)
    }
  }

  await syncJobsToStore()
}

async function handleSwMessage(data: unknown): Promise<void> {
  if (!data || typeof data !== 'object' || !('event' in data)) return
  const msg = data as { event: string; id?: string }
  if (!msg.id) return

  switch (msg.event) {
    case 'download:started':
    case 'download:succeeded':
    case 'download:failed':
    case 'download:stopped':
    case 'download:removed':
    case 'transcribe:started':
    case 'transcribe:succeeded':
    case 'transcribe:failed':
    case 'transcribe:stopped':
    case 'transcribe:removed':
      await syncJobsToStore()
      break
    case 'download:heartbeat':
    case 'transcribe:heartbeat':
      break
  }
}

async function registerDownloadServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!navigator.serviceWorker) return null
  try {
    const registration = await navigator.serviceWorker.register('/download-service-worker.js')
    await navigator.serviceWorker.ready
    return registration
  } catch (e) {
    console.warn('[IndexedDbObserver] SW registration failed', e)
    return null
  }
}

export function IndexedDbObserver() {
  useEffect(() => {
    let cancelled = false

    async function init() {
      const registration = await registerDownloadServiceWorker()
      if (cancelled) return

      if (registration) {
        await startupSync()
      }

      navigator.serviceWorker.addEventListener('message', (event) => {
        void handleSwMessage(event.data)
      })

      window.addEventListener('indexed-updated', () => {
        void syncJobsToStore()
      })
    }

    void init()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
