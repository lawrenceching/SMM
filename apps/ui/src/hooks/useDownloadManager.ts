import { useEffect, useCallback, useState, useMemo, useRef } from "react"
import { Path } from "@core/path"
import { getAllJobs, deleteJob, isWithinOneHour, notifyIndexedDbUpdated, type DownloadJobRecord } from "@/lib/downloadTaskDb"
import {
  UI_DownloadVideoJobFolderRefreshEvent,
  type OnDownloadVideoJobFolderRefreshEventData,
} from "@/types/eventTypes"

const AUTO_START_KEY = 'download.autoStart'

function readAutoStart(): boolean {
  try {
    return localStorage.getItem(AUTO_START_KEY) !== 'false'
  } catch {
    return true
  }
}

async function getFolderJobRecords(folder: string) {
  const records = await getAllJobs()
  return records.filter(
    (r) =>
      r.type === 'download-video' &&
      r.folder === folder &&
      isWithinOneHour(r.createdAt) &&
      r.status !== 'succeeded',
  )
}

function isStartableJob(r: DownloadJobRecord): boolean {
  return r.status !== 'stopped' && r.status !== 'aborted'
}

interface UseDownloadManagerOptions {
  platformFolder: string | undefined
  mediaFolderPath: string | undefined
  onDownloadSucceeded?: () => void
}

export function useDownloadManager({
  platformFolder,
  mediaFolderPath,
  onDownloadSucceeded,
}: UseDownloadManagerOptions) {
  const [autoStart] = useState(readAutoStart)
  const [jobRecords, setJobRecords] = useState<DownloadJobRecord[]>([])
  const onDownloadSucceededRef = useRef(onDownloadSucceeded)
  onDownloadSucceededRef.current = onDownloadSucceeded

  const hasRunningDownload = useMemo(
    () => jobRecords.some((r) => r.status === 'running'),
    [jobRecords],
  )

  const loadJobRecordsFromDb = useCallback(async (folder: string): Promise<DownloadJobRecord[]> => {
    return getFolderJobRecords(folder)
  }, [])

  const refreshAndAutoStart = useCallback(async (folder: string) => {
    const freshRecords = await loadJobRecordsFromDb(folder)
    console.log('[DownloadManager] refreshAndAutoStart', {
      jobCount: freshRecords.length,
      statuses: freshRecords.map((r) => ({ id: r.id, status: r.status, name: r.name })),
      autoStart,
    })
    setJobRecords(freshRecords)
    if (!autoStart) return
    if (freshRecords.some((r) => r.status === 'running')) {
      console.log('[DownloadManager] refreshAndAutoStart: skipping, has running job')
      return
    }
    const nextJob = freshRecords.find((r) => r.status === 'pending' && isStartableJob(r))
    if (nextJob && navigator.serviceWorker?.controller) {
      console.log('[DownloadManager] refreshAndAutoStart: auto-starting pending job', { jobId: nextJob.id, name: nextJob.name })
      navigator.serviceWorker.controller.postMessage({ event: 'download:start', id: nextJob.id })
    }
  }, [loadJobRecordsFromDb, autoStart])

  const startDownload = useCallback((jobId: string) => {
    console.log('[DownloadManager] startDownload called', { jobId })
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ event: 'download:start', id: jobId })
    } else {
      console.warn('[DownloadManager] startDownload: no SW controller available')
    }
  }, [])

  const stopDownload = useCallback((jobId: string) => {
    console.log('[DownloadManager] stopDownload called', { jobId })
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ event: 'download:stop', id: jobId })
    } else {
      console.warn('[DownloadManager] stopDownload: no SW controller available')
    }
  }, [])

  const removeDownload = useCallback(async (jobId: string) => {
    console.log('[DownloadManager] removeDownload called', { jobId })
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ event: 'download:stop', id: jobId })
    }
    await deleteJob(jobId)
    notifyIndexedDbUpdated()
  }, [])

  useEffect(() => {
    if (!platformFolder) {
      setJobRecords([])
      return
    }
    void loadJobRecordsFromDb(platformFolder).then(setJobRecords)
  }, [platformFolder, loadJobRecordsFromDb])

  useEffect(() => {
    if (!platformFolder) return
    const handler = () => {
      void refreshAndAutoStart(platformFolder)
    }
    window.addEventListener('indexed-updated', handler)
    return () => window.removeEventListener('indexed-updated', handler)
  }, [platformFolder, refreshAndAutoStart])

  useEffect(() => {
    if (!mediaFolderPath) return
    const folder = Path.toPlatformPath(mediaFolderPath)
    const handler = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object' || !('event' in data)) return
      const msg = data as { event: string; id?: string }
      if (!msg.id) return

      console.log('[DownloadManager] SW message received', { event: msg.event, id: msg.id })

      if (msg.event === 'download:succeeded') {
        onDownloadSucceededRef.current?.()
        void refreshAndAutoStart(folder)
        return
      }

      switch (msg.event) {
        case 'download:started':
          void loadJobRecordsFromDb(folder).then(setJobRecords)
          break
        case 'download:failed':
          void loadJobRecordsFromDb(folder).then(setJobRecords)
          break
        case 'download:stopped':
          void loadJobRecordsFromDb(folder).then((freshRecords) => {
            setJobRecords(freshRecords)
            if (!autoStart) return
            if (freshRecords.some((r) => r.status === 'running')) return
            const nextJob = freshRecords.find((r) => r.status === 'pending' && isStartableJob(r))
            if (nextJob && navigator.serviceWorker?.controller) {
              console.log('[DownloadManager] starting next pending job after stop', { jobId: nextJob.id, name: nextJob.name, stoppedJobId: msg.id })
              navigator.serviceWorker.controller.postMessage({ event: 'download:start', id: nextJob.id })
            }
          })
          break
      }
    }
    navigator.serviceWorker?.addEventListener('message', handler)
    return () => navigator.serviceWorker?.removeEventListener('message', handler)
  }, [mediaFolderPath, loadJobRecordsFromDb, refreshAndAutoStart])

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<OnDownloadVideoJobFolderRefreshEventData>
      const folder = ce.detail?.folder
      if (!folder || !mediaFolderPath) return
      if (Path.toPlatformPath(folder) !== Path.toPlatformPath(mediaFolderPath)) return
      onDownloadSucceededRef.current?.()
    }
    document.addEventListener(UI_DownloadVideoJobFolderRefreshEvent, handler)
    return () => document.removeEventListener(UI_DownloadVideoJobFolderRefreshEvent, handler)
  }, [mediaFolderPath])

  return {
    jobRecords,
    hasRunningDownload,
    startDownload,
    stopDownload,
    removeDownload,
  }
}
