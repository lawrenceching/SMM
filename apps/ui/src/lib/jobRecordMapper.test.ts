import { describe, it, expect, beforeEach } from 'vitest'
import { jobRecordToBackgroundJob, syncJobRecordsToStore } from './jobRecordMapper'
import { useBackgroundJobsStore } from '@/stores/backgroundJobsStore'
import type { TaskJobRecord } from '@/lib/downloadTaskDb'

function makeDownloadRecord(id: string): TaskJobRecord {
  return {
    id,
    name: 'Download',
    status: 'succeeded',
    progress: 100,
    type: 'download-video',
    folder: '/media',
    data: JSON.stringify({ folder: '/media', videos: [] }),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

describe('jobRecordToBackgroundJob', () => {
  it('maps test-delay records', () => {
    const job = jobRecordToBackgroundJob({
      id: 't1',
      name: 'Test',
      status: 'running',
      progress: 40,
      type: 'test-delay',
      folder: '',
      data: JSON.stringify({ delayMs: 30_000, outcome: 'failed', startedAt: 1_000 }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    expect(job).toMatchObject({
      id: 't1',
      type: 'test-delay',
      data: { delayMs: 30_000, outcome: 'failed', startedAt: 1_000 },
    })
  })

  it('does not deserialize transient progress fields (removed from type)', () => {
    const job = jobRecordToBackgroundJob({
      id: 'd1',
      name: 'Download',
      status: 'running',
      progress: 42,
      type: 'download-video',
      folder: '/media',
      data: JSON.stringify({
        folder: '/media',
        videos: [{ url: 'https://example.com/v1', artist: 'A', title: 'T1', status: 'downloading' }],
        // These fields were removed from DownloadVideoBackgroundJobData in 2026-06-04.
        // The mapper should ignore them, not crash.
        activeVideoProgress: 42,
        downloadSpeedBps: 1_500_000,
        downloadEtaSeconds: 95,
      }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    expect(job).toBeDefined()
    if (job?.type === 'download-video') {
      // The fields must not appear on the type after deserialization.
      // TypeScript will catch any accidental reads at compile time.
      expect(job.data).not.toHaveProperty('activeVideoProgress')
      expect(job.data).not.toHaveProperty('downloadSpeedBps')
      expect(job.data).not.toHaveProperty('downloadEtaSeconds')
    }
  })
})

describe('syncJobRecordsToStore', () => {
  beforeEach(() => {
    useBackgroundJobsStore.setState({ jobs: [] })
  })

  it('removes persisted jobs when records array is empty but keeps generic jobs', () => {
    syncJobRecordsToStore([makeDownloadRecord('job-a')])
    useBackgroundJobsStore.setState((state) => ({
      jobs: [
        ...state.jobs,
        {
          id: 'generic-1',
          name: 'Import',
          status: 'running',
          progress: 0,
          type: 'generic',
          data: {},
        },
      ],
    }))
    expect(useBackgroundJobsStore.getState().jobs).toHaveLength(2)

    syncJobRecordsToStore([])
    const remaining = useBackgroundJobsStore.getState().jobs
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.id).toBe('generic-1')
  })

  it('replaces persisted jobs atomically on each sync', () => {
    syncJobRecordsToStore([makeDownloadRecord('job-a'), makeDownloadRecord('job-b')])
    expect(useBackgroundJobsStore.getState().jobs).toHaveLength(2)

    syncJobRecordsToStore([makeDownloadRecord('job-b'), makeDownloadRecord('job-c')])
    const ids = useBackgroundJobsStore.getState().jobs.map((j) => j.id).sort()
    expect(ids).toEqual(['job-b', 'job-c'])
  })
})
