import { create } from 'zustand'
import type { BackgroundJob, GenericBackgroundJob } from '@/types/background-jobs'
import { useStatusbarStore } from '@/stores/statusbarStore'

function newJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

interface BackgroundJobsState {
  jobs: BackgroundJob[]
  /**
   * Append a job: pass a display name for a generic placeholder job, or a full {@link BackgroundJob}.
   */
  addJob: (nameOrJob: string | BackgroundJob) => string
  updateJob: (id: string, updates: Partial<BackgroundJob>) => void
  /** Replace one job by id with the result of `fn` (type-agnostic). */
  patchJob: (id: string, fn: (job: BackgroundJob) => BackgroundJob) => void
  abortJob: (id: string) => void
  getRunningJobs: () => BackgroundJob[]
  getJobsByType: (type: string) => BackgroundJob[]
  removeJob: (id: string) => void
}

export const useBackgroundJobsStore = create<BackgroundJobsState>()((set, get) => ({
  jobs: [],

  addJob: (nameOrJob: string | BackgroundJob) => {
    if (typeof nameOrJob === 'string') {
      const id = newJobId()
      const newJob: GenericBackgroundJob = {
        id,
        name: nameOrJob,
        status: 'pending',
        progress: 0,
        type: 'generic',
        data: {},
      }
      set((state) => ({
        jobs: [...state.jobs, newJob],
      }))
      useStatusbarStore.getState().setBackgroundJobsPopoverOpen(true)
      return id
    }
    const job = nameOrJob
    set((state) => ({
      jobs: [...state.jobs, job],
    }))
    useStatusbarStore.getState().setBackgroundJobsPopoverOpen(true)
    return job.id
  },

  updateJob: (id, updates) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id ? ({ ...job, ...updates } as BackgroundJob) : job
      ),
    })),

  patchJob: (id, fn) =>
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === id ? fn(job) : job)),
    })),

  abortJob: (id) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id && job.status === 'running' ? { ...job, status: 'aborted' } : job
      ),
    })),

  getRunningJobs: () => get().jobs.filter((job) => job.status === 'running'),

  getJobsByType: (type) => get().jobs.filter((j) => j.type === type),

  removeJob: (id) =>
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== id),
    })),
}))
