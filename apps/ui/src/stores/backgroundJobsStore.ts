import { create } from 'zustand'
import type { BackgroundJob } from '@/types/background-jobs'

interface BackgroundJobsState {
  jobs: BackgroundJob[]
  isPopoverOpen: boolean
  addJob: (name: string) => string
  updateJob: (id: string, updates: Partial<BackgroundJob>) => void
  abortJob: (id: string) => void
  getRunningJobs: () => BackgroundJob[]
  setPopoverOpen: (open: boolean) => void
}

export const useBackgroundJobsStore = create<BackgroundJobsState>((set, get) => ({
  jobs: [],
  isPopoverOpen: false,

  addJob: (name: string) => {
    const id = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newJob: BackgroundJob = {
      id,
      name,
      status: 'pending',
      progress: 0,
    }
    set((state) => ({
      jobs: [...state.jobs, newJob],
      isPopoverOpen: true,
    }))
    return id
  },

  updateJob: (id, updates) =>
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...updates } : job)),
    })),

  abortJob: (id) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id && job.status === 'running' ? { ...job, status: 'aborted' } : job
      ),
    })),

  getRunningJobs: () => get().jobs.filter((job) => job.status === 'running'),

  setPopoverOpen: (open) => set({ isPopoverOpen: open }),
}))
