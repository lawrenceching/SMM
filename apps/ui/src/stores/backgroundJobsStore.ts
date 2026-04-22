import { create } from 'zustand'
import type { BackgroundJob, GenericBackgroundJob, TranscribeBackgroundJob } from '@/types/background-jobs'

function newJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

interface BackgroundJobsState {
  jobs: BackgroundJob[]
  isPopoverOpen: boolean
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
  setPopoverOpen: (open: boolean) => void
  createTranscribeJob: (trackTitle: string, mediaPath: string) => string
  markTranscribeJobRunning: (id: string) => void
  markTranscribeJobSucceeded: (id: string) => void
  markTranscribeJobFailed: (id: string) => void
}

export const useBackgroundJobsStore = create<BackgroundJobsState>()((set, get) => ({
  jobs: [],
  isPopoverOpen: false,

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
        isPopoverOpen: true,
      }))
      return id
    }
    const job = nameOrJob
    set((state) => ({
      jobs: [...state.jobs, job],
      isPopoverOpen: true,
    }))
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

  setPopoverOpen: (open) => set({ isPopoverOpen: open }),

  createTranscribeJob: (trackTitle, mediaPath) => {
    const id = newJobId()
    const newJob: TranscribeBackgroundJob = {
      id,
      name: `Transcribe: ${trackTitle}`,
      status: 'pending',
      progress: 0,
      type: 'transcribe',
      data: {
        trackTitle,
        mediaPath,
      },
    }
    set((state) => ({
      jobs: [...state.jobs, newJob],
      isPopoverOpen: true,
    }))
    return id
  },

  markTranscribeJobRunning: (id) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id ? ({ ...job, status: 'running' } as BackgroundJob) : job
      ),
    })),

  markTranscribeJobSucceeded: (id) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id ? ({ ...job, status: 'succeeded', progress: 100 } as BackgroundJob) : job
      ),
    })),

  markTranscribeJobFailed: (id) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id ? ({ ...job, status: 'failed' } as BackgroundJob) : job
      ),
    })),
}))
