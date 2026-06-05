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

  it('maps ffmpeg-convert records', () => {
    const job = jobRecordToBackgroundJob({
      id: 'fc1',
      name: 'Convert: sample.mkv',
      status: 'running',
      progress: 0,
      type: 'ffmpeg-convert',
      folder: '',
      data: JSON.stringify({
        folder: '',
        inputPath: '/media/sample.mkv',
        inputPathPlatform: 'C:\\media\\sample.mkv',
        outputPath: '/media/sample (1).webp',
        outputPathPlatform: 'C:\\media\\sample (1).webp',
        outputFormat: 'webp',
        preset: 'balanced',
        title: 'sample.mkv',
      }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    expect(job).toMatchObject({
      id: 'fc1',
      type: 'ffmpeg-convert',
      status: 'running',
      data: {
        inputPath: '/media/sample.mkv',
        outputFormat: 'webp',
        title: 'sample.mkv',
      },
    })
  })

  it('maps ffmpeg-write-tags records', () => {
    const job = jobRecordToBackgroundJob({
      id: 'wt1',
      name: 'Write tags: track.mp3',
      status: 'pending',
      progress: 0,
      type: 'ffmpeg-write-tags',
      folder: '/music',
      data: JSON.stringify({
        folder: '/music',
        filePath: '/music/track.mp3',
        filePathPlatform: 'C:\\music\\track.mp3',
        title: 'track.mp3',
        tags: { artist: 'A', title: 'T' },
      }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    expect(job).toMatchObject({
      id: 'wt1',
      type: 'ffmpeg-write-tags',
      data: { tags: { artist: 'A', title: 'T' } },
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

  it('syncs ffmpeg-convert records into the store', () => {
    syncJobRecordsToStore([
      {
        id: 'fc1',
        name: 'Convert: sample.mkv',
        status: 'pending',
        progress: 0,
        type: 'ffmpeg-convert',
        folder: '',
        data: JSON.stringify({
          folder: '',
          inputPath: '/media/sample.mkv',
          inputPathPlatform: '/media/sample.mkv',
          outputPath: '/media/sample.webp',
          outputPathPlatform: '/media/sample.webp',
          outputFormat: 'webp',
          preset: 'balanced',
          title: 'sample.mkv',
        }),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ])
    expect(useBackgroundJobsStore.getState().jobs).toHaveLength(1)
    expect(useBackgroundJobsStore.getState().jobs[0]?.type).toBe('ffmpeg-convert')
  })

  it('replaces persisted jobs atomically on each sync', () => {
    syncJobRecordsToStore([makeDownloadRecord('job-a'), makeDownloadRecord('job-b')])
    expect(useBackgroundJobsStore.getState().jobs).toHaveLength(2)

    syncJobRecordsToStore([makeDownloadRecord('job-b'), makeDownloadRecord('job-c')])
    const ids = useBackgroundJobsStore.getState().jobs.map((j) => j.id).sort()
    expect(ids).toEqual(['job-b', 'job-c'])
  })
})
