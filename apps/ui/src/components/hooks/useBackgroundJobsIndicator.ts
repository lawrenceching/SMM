import { useBackgroundJobsStore } from '@/stores/backgroundJobsStore'

interface UseBackgroundJobsIndicatorResult {
  shouldRender: boolean
  isRunning: boolean
  runningCount: number
  activeCount: number
  isPopoverOpen: boolean
  setPopoverOpen: (open: boolean) => void
}

export function useBackgroundJobsIndicator(): UseBackgroundJobsIndicatorResult {
  const { getRunningJobs, jobs, isPopoverOpen, setPopoverOpen } = useBackgroundJobsStore()
  const runningJobs = getRunningJobs()
  const runningCount = runningJobs.length

  const activeJobs = jobs.filter(
    (j) => j.status === 'running' || j.status === 'pending'
  )
  const activeCount = activeJobs.length

  return {
    shouldRender: jobs.length > 0 && activeCount > 0,
    isRunning: runningCount > 0,
    runningCount,
    activeCount,
    isPopoverOpen,
    setPopoverOpen,
  }
}
