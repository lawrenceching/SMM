import { useCallback, useMemo } from 'react'
import { useJobOrchestratorContext } from '@/components/JobOrchestratorProvider'
import type { StartJobResult } from '@/components/JobOrchestratorProvider'
import { jobRecordToBackgroundJob } from '@/lib/jobRecordMapper'
import { useBackgroundJobsStore } from '@/stores/backgroundJobsStore'
import type { BackgroundJob } from '@/types/background-jobs'
import {
  isDownloadVideoJob,
  isGenericBackgroundJob,
  isProcessBackgroundJob,
  isSynthesizeBackgroundJob,
  isTranscribeBackgroundJob,
  isTranslateBackgroundJob,
} from '@/types/background-jobs'

function isPersistedFromIdbJob(job: BackgroundJob): boolean {
  return (
    isDownloadVideoJob(job) ||
    isTranscribeBackgroundJob(job) ||
    isTranslateBackgroundJob(job) ||
    isSynthesizeBackgroundJob(job) ||
    isProcessBackgroundJob(job)
  )
}

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
  const orchestrator = useJobOrchestratorContext()
  const storeJobs = useBackgroundJobsStore((s) => s.jobs)
  const addJob = useBackgroundJobsStore((s) => s.addJob)
  const updateJob = useBackgroundJobsStore((s) => s.updateJob)
  const patchJob = useBackgroundJobsStore((s) => s.patchJob)

  const jobs = useMemo(() => {
    const persistedInStore = storeJobs.filter(isPersistedFromIdbJob)
    if (persistedInStore.length > 0) {
      return storeJobs
    }

    const fromRecords: BackgroundJob[] = []
    for (const record of orchestrator.popoverJobRecords) {
      const job = jobRecordToBackgroundJob(record)
      if (job) fromRecords.push(job)
    }
    return fromRecords
  }, [storeJobs, orchestrator.popoverJobRecords])

  const stopJob = useCallback(
    (id: string) => {
      const job = useBackgroundJobsStore.getState().jobs.find((j) => j.id === id)
      if (job && isGenericBackgroundJob(job)) {
        useBackgroundJobsStore.getState().abortJob(id)
        return
      }
      orchestrator.stopJob(id)
    },
    [orchestrator],
  )

  return {
    jobs,
    refreshFromIndexedDB: orchestrator.refreshFromIndexedDB,
    isReady: orchestrator.isReady,
    createJob: orchestrator.createJob,
    createJobs: orchestrator.createJobs,
    startJob: orchestrator.startJob,
    stopJob,
    removeJob: orchestrator.removeJob,
    addJob,
    updateJob,
    patchJob,
  }
}
