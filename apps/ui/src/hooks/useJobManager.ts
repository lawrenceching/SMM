import { useCallback } from 'react'
import { toast } from 'sonner'
import { useJobOrchestratorContext } from '@/components/JobOrchestratorProvider'
import type { StartJobResult } from '@/components/JobOrchestratorProvider'
import { isJobRemovable } from '@/lib/backgroundJobLifecycle'
import { useTranslation } from '@/lib/i18n'
import { useBackgroundJobsStore } from '@/stores/backgroundJobsStore'
import type { BackgroundJob } from '@/types/background-jobs'
import { clearTestDelayJobTimers, stopTestDelayJob } from '@/lib/testDelayJobRunner'
import { isGenericBackgroundJob, isTestDelayBackgroundJob } from '@/types/background-jobs'

export interface UseJobManagerResult {
  jobs: BackgroundJob[]
  refreshFromIndexedDB: (source?: string) => Promise<void>
  isReady: boolean
  createJob: (job: BackgroundJob) => Promise<string>
  createJobs: (jobs: BackgroundJob[]) => Promise<{
    successIds: string[]
    failures: Array<{ job: BackgroundJob; error: string }>
  }>
  startJob: (id: string, options?: { forceStart?: boolean }) => Promise<StartJobResult>
  stopJob: (id: string) => void
  removeJob: (id: string) => Promise<void>
  clearRemovableJobs: () => Promise<void>
  addJob: (nameOrJob: string | BackgroundJob) => string
  updateJob: (id: string, updates: Partial<BackgroundJob>) => void
  patchJob: (id: string, fn: (job: BackgroundJob) => BackgroundJob) => void
}

/**
 * Unified hook for background job display and lifecycle.
 * Combines Zustand job state with JobOrchestrator (IndexedDB + Service Worker).
 * Status bar UI state (popover open/close) lives in {@link useStatusbarStore}.
 */
export function useJobManager(): UseJobManagerResult {
  const { t } = useTranslation('components')
  const orchestrator = useJobOrchestratorContext()
  const jobs = useBackgroundJobsStore((s) => s.jobs)
  const addJob = useBackgroundJobsStore((s) => s.addJob)
  const updateJob = useBackgroundJobsStore((s) => s.updateJob)
  const patchJob = useBackgroundJobsStore((s) => s.patchJob)

  const stopJob = useCallback(
    (id: string) => {
      const job = useBackgroundJobsStore.getState().jobs.find((j) => j.id === id)
      if (job && isGenericBackgroundJob(job)) {
        useBackgroundJobsStore.getState().abortJob(id)
        return
      }
      if (job && isTestDelayBackgroundJob(job)) {
        void stopTestDelayJob(id)
        return
      }
      orchestrator.stopJob(id)
    },
    [orchestrator],
  )

  const removeJob = useCallback(
    async (id: string) => {
      const job =
        useBackgroundJobsStore.getState().jobs.find((j) => j.id === id) ??
        jobs.find((j) => j.id === id)
      if (job && isGenericBackgroundJob(job)) {
        useBackgroundJobsStore.getState().removeJob(id)
        return
      }
      if (job && isTestDelayBackgroundJob(job)) {
        clearTestDelayJobTimers(id)
      }
      await orchestrator.removeJob(id)
    },
    [orchestrator, jobs],
  )

  const clearRemovableJobs = useCallback(async () => {
    const removable = jobs.filter((j) => isJobRemovable(j.status))
    if (removable.length === 0) return

    const results = await Promise.allSettled(removable.map((j) => removeJob(j.id)))
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) {
      toast.error(t('statusBar.backgroundJobs.clearFailed', { count: failed }))
    }
  }, [jobs, removeJob, t])

  return {
    jobs,
    refreshFromIndexedDB: orchestrator.refreshFromIndexedDB,
    isReady: orchestrator.isReady,
    createJob: orchestrator.createJob,
    createJobs: orchestrator.createJobs,
    startJob: orchestrator.startJob,
    stopJob,
    removeJob,
    clearRemovableJobs,
    addJob,
    updateJob,
    patchJob,
  }
}
