import { useCallback } from 'react'
import { useJobManager } from '@/hooks/useJobManager'
import { useBackgroundJobsStore } from '@/stores/backgroundJobsStore'
import { useStatusbarStore } from '@/stores/statusbarStore'
import { isDownloadVideoJob } from '@/types/background-jobs'

interface UseBackgroundJobsIndicatorResult {
  shouldRender: boolean
  statusVariant: 'running' | 'warning' | 'success'
  runningCount: number
  activeCount: number
  isPopoverOpen: boolean
  setPopoverOpen: (open: boolean) => void
}

export function useBackgroundJobsIndicator(): UseBackgroundJobsIndicatorResult {
  const { jobs, refreshFromIndexedDB } = useJobManager()
  const isPopoverOpen = useStatusbarStore((s) => s.isBackgroundJobsPopoverOpen)
  const setBackgroundJobsPopoverOpen = useStatusbarStore((s) => s.setBackgroundJobsPopoverOpen)

  const setPopoverOpen = useCallback(
    (open: boolean) => {
      if (!open) {
        setBackgroundJobsPopoverOpen(false)
        return
      }
      const run = async () => {
        if (useBackgroundJobsStore.getState().jobs.length === 0) {
          await refreshFromIndexedDB('popover-open')
        }
        setBackgroundJobsPopoverOpen(true)
      }
      void run()
    },
    [setBackgroundJobsPopoverOpen, refreshFromIndexedDB],
  )

  const runningJobs = jobs.filter((job) => {
    if (job.status === 'running') return true
    if (!isDownloadVideoJob(job) || job.status !== 'pending') return false
    return job.data.videos.some((item) => item.status === 'downloading')
  })
  const runningCount = runningJobs.length
  const failedOrAbortedCount = jobs.filter(
    (j) => j.status === 'failed' || j.status === 'aborted'
  ).length

  const activeJobs = jobs.filter(
    (j) => j.status === 'running' || j.status === 'pending'
  )
  const activeCount = activeJobs.length
  const hasRunning = runningCount > 0
  const hasFailedOrAborted = failedOrAbortedCount > 0
  const statusVariant = hasRunning ? 'running' : hasFailedOrAborted ? 'warning' : 'success'

  return {
    shouldRender: true,
    statusVariant,
    runningCount,
    activeCount,
    isPopoverOpen,
    setPopoverOpen,
  }
}
