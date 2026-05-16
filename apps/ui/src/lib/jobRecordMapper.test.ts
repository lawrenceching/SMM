import { describe, it, expect, beforeEach } from 'vitest'
import { syncJobRecordsToStore } from './jobRecordMapper'
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

describe('syncJobRecordsToStore', () => {
  beforeEach(() => {
    useBackgroundJobsStore.setState({ jobs: [] })
  })

  it('does not remove persisted jobs when records array is empty', () => {
    syncJobRecordsToStore([makeDownloadRecord('job-a')])
    expect(useBackgroundJobsStore.getState().jobs).toHaveLength(1)

    syncJobRecordsToStore([])
    expect(useBackgroundJobsStore.getState().jobs).toHaveLength(1)
    expect(useBackgroundJobsStore.getState().jobs[0]?.id).toBe('job-a')
  })

  it('replaces persisted jobs atomically on each sync', () => {
    syncJobRecordsToStore([makeDownloadRecord('job-a'), makeDownloadRecord('job-b')])
    expect(useBackgroundJobsStore.getState().jobs).toHaveLength(2)

    syncJobRecordsToStore([makeDownloadRecord('job-b'), makeDownloadRecord('job-c')])
    const ids = useBackgroundJobsStore.getState().jobs.map((j) => j.id).sort()
    expect(ids).toEqual(['job-b', 'job-c'])
  })
})
