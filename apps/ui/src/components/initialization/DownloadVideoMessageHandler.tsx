import { useEffect } from 'react'
import { registerDownloadVideoWorkerMessageHandler } from '@/workers/DownloadVideoWorker'

/**
 * Listens for postMessage events from `downloadVideo.worker.ts` and updates BackgroundJobStore.
 * Mount at app startup so download progress is applied even after DownloadVideoDialog closes.
 */
export function DownloadVideoMessageHandler() {
  useEffect(() => {
    return registerDownloadVideoWorkerMessageHandler()
  }, [])
  return null
}
