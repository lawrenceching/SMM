import { create } from 'zustand'
import type { BackgroundJob, GenericBackgroundJob } from '@/types/background-jobs'
import { useStatusbarStore } from '@/stores/statusbarStore'
import { logger } from '@/lib/log'

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
      logger.info({ jobId: id, status: newJob.status, name: newJob.name, type: newJob.type }, 'job:update add')
      return id
    }
    const job = nameOrJob
    set((state) => ({
      jobs: [...state.jobs, job],
    }))
    useStatusbarStore.getState().setBackgroundJobsPopoverOpen(true)
    logger.info({ jobId: job.id, status: job.status, name: job.name, type: job.type }, 'job:update add')
    return job.id
  },

  updateJob: (id, updates) => {
    const updatedStatus = (updates as Partial<BackgroundJob>).status
    const updatedName = (updates as Partial<BackgroundJob>).name
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id ? ({ ...job, ...updates } as BackgroundJob) : job
      ),
    }))
    logger.info({ jobId: id, status: updatedStatus, name: updatedName }, 'job:update update')
  },

  patchJob: (id, fn) => {
    const target = get().jobs.find((j) => j.id === id)
    if (!target) return
    const next = fn(target)
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === id ? next : job)),
    }))
    logger.info({ jobId: id, status: next.status, name: next.name }, 'job:update patch')
  },

  abortJob: (id) => {
    const target = get().jobs.find((j) => j.id === id)
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id && (job.status === 'running' || job.status === 'pending')
          ? { ...job, status: 'aborted' }
          : job
      ),
    }))
    logger.info({ jobId: id, previousStatus: target?.status, status: 'aborted', name: target?.name }, 'job:update abort')
  },

  getRunningJobs: () => get().jobs.filter((job) => job.status === 'running'),

  getJobsByType: (type) => get().jobs.filter((j) => j.type === type),

  removeJob: (id) => {
    const target = get().jobs.find((j) => j.id === id)
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== id),
    }))
    logger.info({ jobId: id, status: target?.status, name: target?.name }, 'job:update remove')
  },
}))
