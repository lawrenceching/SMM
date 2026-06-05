import { describe, it, expect, beforeEach } from 'vitest'
import type { GenericBackgroundJob } from '@/types/background-jobs'
import { useBackgroundJobsStore } from './backgroundJobsStore'
import { useStatusbarStore } from './statusbarStore'

describe('backgroundJobsStore', () => {
  beforeEach(() => {
    useBackgroundJobsStore.setState({ jobs: [] })
    useStatusbarStore.setState({ isBackgroundJobsPopoverOpen: false })
  })

  it('addJob(name) creates a generic job', () => {
    const id = useBackgroundJobsStore.getState().addJob('Init')
    const j = useBackgroundJobsStore.getState().jobs.find((x) => x.id === id)!
    expect(j.type).toBe('generic')
    expect(j.name).toBe('Init')
    expect(j.data).toEqual({})
    expect(useStatusbarStore.getState().isBackgroundJobsPopoverOpen).toBe(true)
  })

  it('addJob(full job) appends the job and returns its id', () => {
    const job: GenericBackgroundJob = {
      id: 'custom-id',
      name: 'X',
      status: 'pending',
      progress: 0,
      type: 'generic',
      data: {},
    }
    const id = useBackgroundJobsStore.getState().addJob(job)
    expect(id).toBe('custom-id')
    expect(useBackgroundJobsStore.getState().jobs).toHaveLength(1)
    expect(useBackgroundJobsStore.getState().jobs[0]!.id).toBe('custom-id')
  })

  it('patchJob replaces a job by id', () => {
    const id = useBackgroundJobsStore.getState().addJob('Test')
    useBackgroundJobsStore.getState().patchJob(id, (j) => ({
      ...j,
      name: 'Renamed',
      progress: 50,
    }))
    const j = useBackgroundJobsStore.getState().jobs.find((x) => x.id === id)!
    expect(j.name).toBe('Renamed')
    expect(j.progress).toBe(50)
  })

  describe('abortJob', () => {
    it('transitions a running job to aborted', () => {
      const id = useBackgroundJobsStore.getState().addJob('Run')
      useBackgroundJobsStore.getState().updateJob(id, { status: 'running' })
      useBackgroundJobsStore.getState().abortJob(id)
      const j = useBackgroundJobsStore.getState().jobs.find((x) => x.id === id)!
      expect(j.status).toBe('aborted')
    })

    it('transitions a pending job to aborted (used by stopAllJobs phase 1)', () => {
      const id = useBackgroundJobsStore.getState().addJob('Queued')
      // Newly added generic jobs start in `pending` by default.
      expect(
        useBackgroundJobsStore.getState().jobs.find((x) => x.id === id)!.status
      ).toBe('pending')
      useBackgroundJobsStore.getState().abortJob(id)
      const j = useBackgroundJobsStore.getState().jobs.find((x) => x.id === id)!
      expect(j.status).toBe('aborted')
    })

    it('does not change succeeded or failed jobs', () => {
      const sId = useBackgroundJobsStore.getState().addJob('Done')
      useBackgroundJobsStore.getState().updateJob(sId, { status: 'succeeded' })
      const fId = useBackgroundJobsStore.getState().addJob('Boom')
      useBackgroundJobsStore.getState().updateJob(fId, { status: 'failed' })
      useBackgroundJobsStore.getState().abortJob(sId)
      useBackgroundJobsStore.getState().abortJob(fId)
      expect(
        useBackgroundJobsStore.getState().jobs.find((x) => x.id === sId)!.status
      ).toBe('succeeded')
      expect(
        useBackgroundJobsStore.getState().jobs.find((x) => x.id === fId)!.status
      ).toBe('failed')
    })
  })
})
