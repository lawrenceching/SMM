import { useEffect, useCallback, useState, useMemo, useRef } from 'react'
import {
  deleteJob,
  getJobsByTypeAndFolder,
  notifyIndexedDbUpdated,
  type TaskJobRecord,
} from '@/lib/downloadTaskDb'

function readAutoStart(key: string): boolean {
  try {
    return localStorage.getItem(key) !== 'false'
  } catch {
    return true
  }
}

function isStartableJob(r: TaskJobRecord): boolean {
  return r.status !== 'stopped' && r.status !== 'aborted'
}

export type TaskJobMessagePrefix = 'download' | 'transcribe'

export interface UseJobManagerOptions {
  jobType: 'download-video' | 'transcribe'
  messagePrefix: TaskJobMessagePrefix
  platformFolder: string | undefined
  autoStartKey: string
  onJobSucceeded?: () => void
}

export function useJobManager({
  jobType,
  messagePrefix,
  platformFolder,
  autoStartKey,
  onJobSucceeded,
}: UseJobManagerOptions) {
  const [autoStart] = useState(() => readAutoStart(autoStartKey))
  const [jobRecords, setJobRecords] = useState<TaskJobRecord[]>([])
  const onSucceededRef = useRef(onJobSucceeded)
  onSucceededRef.current = onJobSucceeded

  const startEvent = `${messagePrefix}:start`
  const succeededEvent = `${messagePrefix}:succeeded`
  const failedEvent = `${messagePrefix}:failed`
  const startedEvent = `${messagePrefix}:started`
  const stoppedEvent = `${messagePrefix}:stopped`

  const hasRunningJob = useMemo(
    () => jobRecords.some((r) => r.status === 'running'),
    [jobRecords],
  )

  const loadJobRecordsFromDb = useCallback(
    async (folder: string): Promise<TaskJobRecord[]> => {
      return getJobsByTypeAndFolder(jobType, folder)
    },
    [jobType],
  )

  const postSw = useCallback(
    (event: string, id: string) => {
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ event, id })
      } else {
        console.warn(`[JobManager:${messagePrefix}] no SW controller`, { event, id })
      }
    },
    [messagePrefix],
  )

  const refreshAndAutoStart = useCallback(
    async (folder: string) => {
      const freshRecords = await loadJobRecordsFromDb(folder)
      console.log(`[JobManager:${messagePrefix}] refreshAndAutoStart`, {
        jobCount: freshRecords.length,
        statuses: freshRecords.map((r) => ({ id: r.id, status: r.status, name: r.name })),
        autoStart,
      })
      setJobRecords(freshRecords)
      if (!autoStart) return
      if (freshRecords.some((r) => r.status === 'running')) {
        console.log(`[JobManager:${messagePrefix}] refreshAndAutoStart: skipping, has running job`)
        return
      }
      const nextJob = freshRecords.find((r) => r.status === 'pending' && isStartableJob(r))
      if (nextJob) {
        console.log(`[JobManager:${messagePrefix}] auto-starting pending job`, {
          jobId: nextJob.id,
          name: nextJob.name,
        })
        postSw(startEvent, nextJob.id)
      }
    },
    [loadJobRecordsFromDb, autoStart, postSw, startEvent, messagePrefix],
  )

  const startJob = useCallback(
    (jobId: string) => {
      console.log(`[JobManager:${messagePrefix}] startJob`, { jobId })
      postSw(startEvent, jobId)
    },
    [postSw, startEvent, messagePrefix],
  )

  const stopJob = useCallback(
    (jobId: string) => {
      console.log(`[JobManager:${messagePrefix}] stopJob`, { jobId })
      postSw(`${messagePrefix}:stop`, jobId)
    },
    [postSw, messagePrefix],
  )

  const removeJob = useCallback(
    async (jobId: string) => {
      console.log(`[JobManager:${messagePrefix}] removeJob`, { jobId })
      postSw(`${messagePrefix}:stop`, jobId)
      await deleteJob(jobId)
      notifyIndexedDbUpdated()
    },
    [postSw, messagePrefix],
  )

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
    if (!platformFolder) return
    const handler = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object' || !('event' in data)) return
      const msg = data as { event: string; id?: string }
      if (!msg.id) return

      console.log(`[JobManager:${messagePrefix}] SW message`, { event: msg.event, id: msg.id })

      if (msg.event === succeededEvent) {
        onSucceededRef.current?.()
        void refreshAndAutoStart(platformFolder)
        return
      }

      switch (msg.event) {
        case startedEvent:
        case failedEvent:
          void loadJobRecordsFromDb(platformFolder).then(setJobRecords)
          break
        case stoppedEvent:
          void loadJobRecordsFromDb(platformFolder).then((freshRecords) => {
            setJobRecords(freshRecords)
            if (!autoStart) return
            if (freshRecords.some((r) => r.status === 'running')) return
            const nextJob = freshRecords.find((r) => r.status === 'pending' && isStartableJob(r))
            if (nextJob) {
              console.log(`[JobManager:${messagePrefix}] starting next pending after stop`, {
                jobId: nextJob.id,
                stoppedJobId: msg.id,
              })
              postSw(startEvent, nextJob.id)
            }
          })
          break
        default:
          break
      }
    }
    navigator.serviceWorker?.addEventListener('message', handler)
    return () => navigator.serviceWorker?.removeEventListener('message', handler)
  }, [
    platformFolder,
    succeededEvent,
    startedEvent,
    failedEvent,
    stoppedEvent,
    loadJobRecordsFromDb,
    refreshAndAutoStart,
    autoStart,
    postSw,
    startEvent,
    messagePrefix,
  ])

  return {
    jobRecords,
    hasRunningJob,
    startJob,
    stopJob,
    removeJob,
  }
}
