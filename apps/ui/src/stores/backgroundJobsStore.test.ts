import { describe, it, expect, beforeEach } from 'vitest'
import type { GenericBackgroundJob } from '@/types/background-jobs'
import { useBackgroundJobsStore } from './backgroundJobsStore'

describe('backgroundJobsStore', () => {
  beforeEach(() => {
    useBackgroundJobsStore.setState({ jobs: [], isPopoverOpen: false })
  })

  it('addJob(name) creates a generic job', () => {
    const id = useBackgroundJobsStore.getState().addJob('Init')
    const j = useBackgroundJobsStore.getState().jobs.find((x) => x.id === id)!
    expect(j.type).toBe('generic')
    expect(j.name).toBe('Init')
    expect(j.data).toEqual({})
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

  it('creates and updates transcribe jobs', () => {
    const id = useBackgroundJobsStore.getState().createTranscribeJob('Song A', '/media/song-a.mp3')
    let job = useBackgroundJobsStore.getState().jobs.find((x) => x.id === id)!
    expect(job.type).toBe('transcribe')
    expect(job.status).toBe('pending')

    useBackgroundJobsStore.getState().markTranscribeJobRunning(id)
    job = useBackgroundJobsStore.getState().jobs.find((x) => x.id === id)!
    expect(job.status).toBe('running')

    useBackgroundJobsStore.getState().markTranscribeJobSucceeded(id)
    job = useBackgroundJobsStore.getState().jobs.find((x) => x.id === id)!
    expect(job.status).toBe('succeeded')
    expect(job.progress).toBe(100)

    const failedId = useBackgroundJobsStore.getState().createTranscribeJob('Song B', '/media/song-b.mp3')
    useBackgroundJobsStore.getState().markTranscribeJobFailed(failedId)
    const failed = useBackgroundJobsStore.getState().jobs.find((x) => x.id === failedId)!
    expect(failed.status).toBe('failed')
  })
})
