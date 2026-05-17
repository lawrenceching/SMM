import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { TaskJobRecord } from '@/lib/downloadTaskDb'
import {
  buildTestDelayBackgroundJob,
  jobToTaskRecord,
  parseTestDelayData,
  resumeAllTestDelayJobs,
  runTestDelayJob,
  stopTestDelayJob,
  TEST_DELAY_JOB_TYPE,
} from './testDelayJobRunner'

const putJob = vi.fn().mockResolvedValue(undefined)
const getAllJobs = vi.fn().mockResolvedValue([] as TaskJobRecord[])
const notifyIndexedDbUpdated = vi.fn()

vi.mock('@/lib/downloadTaskDb', () => ({
  putJob: (...args: unknown[]) => putJob(...args),
  getAllJobs: () => getAllJobs(),
  notifyIndexedDbUpdated: () => notifyIndexedDbUpdated(),
}))

const updateJob = vi.fn()
vi.mock('@/stores/backgroundJobsStore', () => ({
  useBackgroundJobsStore: {
    setState: vi.fn(),
    getState: () => ({ updateJob }),
  },
}))

vi.mock('@/lib/jobRecordMapper', () => ({
  jobRecordToBackgroundJob: (record: TaskJobRecord) => ({
    id: record.id,
    name: record.name,
    status: record.status,
    progress: record.progress,
    type: record.type,
    data: JSON.parse(record.data || '{}'),
  }),
}))

function makeRecord(overrides: Partial<TaskJobRecord> = {}): TaskJobRecord {
  const now = Date.now()
  return {
    id: 'test-job-1',
    name: 'Test job',
    status: 'pending',
    progress: 0,
    type: TEST_DELAY_JOB_TYPE,
    folder: '',
    data: JSON.stringify({ delayMs: 30_000, outcome: 'failed' }),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('testDelayJobRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    getAllJobs.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('parseTestDelayData reads delay and outcome', () => {
    const data = parseTestDelayData(makeRecord())
    expect(data).toEqual({ delayMs: 30_000, outcome: 'failed' })
  })

  it('runTestDelayJob persists running state then completes with configured outcome', async () => {
    const record = makeRecord()
    await runTestDelayJob(record)

    expect(putJob).toHaveBeenCalled()
    expect(record.status).toBe('running')

    await vi.advanceTimersByTimeAsync(30_000)

    expect(record.status).toBe('failed')
    expect(record.progress).toBe(100)
  })

  it('resumeAllTestDelayJobs completes overdue running jobs immediately', async () => {
    const startedAt = Date.now() - 60_000
    const record = makeRecord({
      status: 'running',
      data: JSON.stringify({ delayMs: 30_000, outcome: 'succeeded', startedAt }),
    })
    getAllJobs.mockResolvedValue([record])

    await resumeAllTestDelayJobs()

    expect(record.status).toBe('succeeded')
    expect(record.progress).toBe(100)
    expect(putJob).toHaveBeenCalled()
  })

  it('resumeAllTestDelayJobs schedules remaining time for in-progress jobs', async () => {
    const startedAt = Date.now() - 10_000
    const record = makeRecord({
      status: 'running',
      data: JSON.stringify({ delayMs: 30_000, outcome: 'succeeded', startedAt }),
    })
    getAllJobs.mockResolvedValue([record])

    await resumeAllTestDelayJobs()

    expect(record.status).toBe('running')
    await vi.advanceTimersByTimeAsync(20_000)
    expect(record.status).toBe('succeeded')
  })

  it('stopTestDelayJob marks job as aborted', async () => {
    const record = makeRecord({ status: 'running' })
    getAllJobs.mockResolvedValue([record])
    await runTestDelayJob(record)

    await stopTestDelayJob(record.id)

    expect(record.status).toBe('aborted')
  })

  it('buildTestDelayBackgroundJob creates pending test-delay job', () => {
    const job = buildTestDelayBackgroundJob({
      name: 'Test',
      delayMs: 10_000,
      outcome: 'failed',
      id: 'fixed-id',
    })
    expect(job.type).toBe('test-delay')
    expect(job.status).toBe('pending')
    expect(jobToTaskRecord(job).type).toBe('test-delay')
  })
})
