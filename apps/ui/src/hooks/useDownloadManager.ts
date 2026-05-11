import { useEffect, useCallback, useRef } from "react"
import { Path } from "@core/path"
import { useJobManager } from "@/hooks/useJobManager"
import {
  UI_DownloadVideoJobFolderRefreshEvent,
  type OnDownloadVideoJobFolderRefreshEventData,
} from "@/types/eventTypes"

const AUTO_START_KEY = 'download.autoStart'

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
  const onDownloadSucceededRef = useRef(onDownloadSucceeded)
  onDownloadSucceededRef.current = onDownloadSucceeded

  const { jobRecords, hasRunningJob, startJob, stopJob, removeJob } = useJobManager({
    jobType: 'download-video',
    messagePrefix: 'download',
    platformFolder,
    autoStartKey: AUTO_START_KEY,
    onJobSucceeded: onDownloadSucceeded,
  })

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

  const startDownload = useCallback((jobId: string) => startJob(jobId), [startJob])
  const stopDownload = useCallback((jobId: string) => stopJob(jobId), [stopJob])
  const removeDownload = useCallback(async (jobId: string) => removeJob(jobId), [removeJob])

  return {
    jobRecords,
    hasRunningDownload: hasRunningJob,
    startDownload,
    stopDownload,
    removeDownload,
  }
}
