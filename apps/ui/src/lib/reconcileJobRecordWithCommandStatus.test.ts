import { describe, expect, it } from 'vitest'
import { reconcileJobRecordWithCommandStatus } from './reconcileJobRecordWithCommandStatus'
import type { TaskJobRecord } from '@/lib/downloadTaskDb'

function makeDownloadRecord(status: string, videos: Array<{ status: string }>): TaskJobRecord {
  return {
    id: 'job-1',
    name: 'Download',
    status,
    progress: 0,
    type: 'download-video',
    folder: '/music',
    data: JSON.stringify({
      folder: '/music',
      executionId: '00000000-0000-4000-8000-000000000001',
      videos,
    }),
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('reconcileJobRecordWithCommandStatus', () => {
  it('returns null when job is not running', () => {
    const record = makeDownloadRecord('failed', [{ status: 'failed' }])
    expect(
      reconcileJobRecordWithCommandStatus(record, {
        executionId: 'x',
        found: true,
        phase: 'finished',
        outcome: 'failure',
      }),
    ).toBeNull()
  })

  it('marks download job failed on CLI failure', () => {
    const record = makeDownloadRecord('running', [
      { status: 'pending' },
      { status: 'downloading' },
    ])
    const next = reconcileJobRecordWithCommandStatus(record, {
      executionId: '00000000-0000-4000-8000-000000000001',
      found: true,
      phase: 'finished',
      outcome: 'failure',
    })
    expect(next?.status).toBe('failed')
    const data = JSON.parse(next!.data!) as { videos: Array<{ status: string }> }
    expect(data.videos[1]?.status).toBe('failed')
  })

  it('on success only updates downloading video and keeps job running', () => {
    const record = makeDownloadRecord('running', [
      { status: 'succeeded' },
      { status: 'downloading' },
      { status: 'pending' },
    ])
    const next = reconcileJobRecordWithCommandStatus(record, {
      executionId: '00000000-0000-4000-8000-000000000001',
      found: true,
      phase: 'finished',
      outcome: 'success',
    })
    expect(next?.status).toBe('running')
    const data = JSON.parse(next!.data!) as { videos: Array<{ status: string }> }
    expect(data.videos[1]?.status).toBe('succeeded')
    expect(data.videos[2]?.status).toBe('pending')
  })

  it('marks transcribe job succeeded', () => {
    const record: TaskJobRecord = {
      id: 't1',
      name: 'Transcribe',
      status: 'running',
      progress: 0,
      type: 'transcribe',
      folder: '/f',
      data: JSON.stringify({
        folder: '/f',
        executionId: '00000000-0000-4000-8000-000000000002',
        mediaPath: '/f/a.mp4',
        mediaPathPlatform: '/f/a.mp4',
        title: 'A',
        provider: 'videoCaptioner',
      }),
      createdAt: 1,
      updatedAt: 1,
    }
    const next = reconcileJobRecordWithCommandStatus(record, {
      executionId: '00000000-0000-4000-8000-000000000002',
      found: true,
      phase: 'finished',
      outcome: 'success',
    })
    expect(next?.status).toBe('succeeded')
  })
})
