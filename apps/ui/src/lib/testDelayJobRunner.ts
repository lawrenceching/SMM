import type { FixedDelayBackgroundJobOutcome } from '@/types/eventTypes'
import type { TestDelayBackgroundJob, TestDelayBackgroundJobData } from '@/types/background-jobs'
import {
  getAllJobs,
  putJob,
  notifyIndexedDbUpdated,
  type TaskJobRecord,
} from '@/lib/downloadTaskDb'
import { jobRecordToBackgroundJob } from '@/lib/jobRecordMapper'
import { useBackgroundJobsStore } from '@/stores/backgroundJobsStore'

export const TEST_DELAY_JOB_TYPE = 'test-delay'

type ActiveHandle = {
  progressInterval: ReturnType<typeof setInterval>
  completionTimeout: ReturnType<typeof setTimeout>
}

const activeJobs = new Map<string, ActiveHandle>()

function newJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function parseTestDelayData(record: TaskJobRecord): TestDelayBackgroundJobData | null {
  if (record.type !== TEST_DELAY_JOB_TYPE) return null
  try {
    const parsed = JSON.parse(record.data || '{}') as Record<string, unknown>
    const delayMs = typeof parsed.delayMs === 'number' ? parsed.delayMs : 0
    const outcome: TestDelayBackgroundJobData['outcome'] =
      parsed.outcome === 'failed' ? 'failed' : 'succeeded'
    const startedAt = typeof parsed.startedAt === 'number' ? parsed.startedAt : undefined
    if (delayMs <= 0) return null
    return { delayMs, outcome, startedAt }
  } catch {
    return null
  }
}

function syncJobToStore(record: TaskJobRecord): void {
  const job = jobRecordToBackgroundJob(record)
  if (!job) return
  useBackgroundJobsStore.setState((state) => {
    const idx = state.jobs.findIndex((j) => j.id === job.id)
    if (idx >= 0) {
      const jobs = [...state.jobs]
      jobs[idx] = job
      return { jobs }
    }
    return { jobs: [...state.jobs, job] }
  })
}

async function persistRecord(record: TaskJobRecord): Promise<void> {
  record.updatedAt = Date.now()
  await putJob(record)
  syncJobToStore(record)
  notifyIndexedDbUpdated()
}

export function clearTestDelayJobTimers(id: string): void {
  const handle = activeJobs.get(id)
  if (!handle) return
  clearInterval(handle.progressInterval)
  clearTimeout(handle.completionTimeout)
  activeJobs.delete(id)
}

function computeProgress(startedAt: number, delayMs: number): number {
  const elapsed = Date.now() - startedAt
  return Math.min((elapsed / delayMs) * 100, 99)
}

export function buildTestDelayBackgroundJob(params: {
  name: string
  delayMs: number
  outcome: FixedDelayBackgroundJobOutcome
  id?: string
}): TestDelayBackgroundJob {
  return {
    id: params.id ?? newJobId(),
    name: params.name,
    status: 'pending',
    progress: 0,
    type: TEST_DELAY_JOB_TYPE,
    data: {
      delayMs: params.delayMs,
      outcome: params.outcome,
    },
  }
}

export function jobToTaskRecord(job: TestDelayBackgroundJob, timestamps?: { createdAt: number; updatedAt: number }): TaskJobRecord {
  const now = Date.now()
  return {
    id: job.id,
    name: job.name,
    status: job.status,
    progress: job.progress,
    type: job.type,
    folder: '',
    data: JSON.stringify(job.data),
    createdAt: timestamps?.createdAt ?? now,
    updatedAt: timestamps?.updatedAt ?? now,
  }
}

export async function runTestDelayJob(record: TaskJobRecord, traceId = 'test-delay'): Promise<void> {
  const data = parseTestDelayData(record)
  if (!data) return
  if (record.status !== 'pending' && record.status !== 'running') return

  clearTestDelayJobTimers(record.id)

  let startedAt = data.startedAt
  if (record.status === 'pending' || startedAt == null) {
    startedAt = Date.now()
    data.startedAt = startedAt
    record.status = 'running'
    record.progress = 0
    record.data = JSON.stringify(data)
    await persistRecord(record)
  } else {
    record.progress = computeProgress(startedAt, data.delayMs)
    syncJobToStore(record)
  }

  const remaining = Math.max(0, data.delayMs - (Date.now() - startedAt))

  const progressInterval = setInterval(() => {
    const progress = computeProgress(startedAt!, data.delayMs)
    useBackgroundJobsStore.getState().updateJob(record.id, { progress })
  }, 50)

  const completionTimeout = setTimeout(() => {
    void (async () => {
      clearInterval(progressInterval)
      activeJobs.delete(record.id)

      record.status = data.outcome
      record.progress = 100
      record.data = JSON.stringify(data)
      await persistRecord(record)
      console.log(`[${traceId}] TestDelayJob: Job "${record.name}" finished as ${data.outcome}`)
    })()
  }, remaining)

  activeJobs.set(record.id, { progressInterval, completionTimeout })
}

export async function stopTestDelayJob(id: string): Promise<void> {
  clearTestDelayJobTimers(id)
  const records = await getAllJobs()
  const record = records.find((r) => r.id === id)
  if (!record || record.type !== TEST_DELAY_JOB_TYPE) return
  if (record.status !== 'running' && record.status !== 'pending') return
  record.status = 'aborted'
  await persistRecord(record)
}

export async function resumeAllTestDelayJobs(): Promise<void> {
  const records = await getAllJobs()
  for (const record of records) {
    if (record.type !== TEST_DELAY_JOB_TYPE) continue
    if (record.status !== 'pending' && record.status !== 'running') continue

    const data = parseTestDelayData(record)
    if (!data) continue

    if (record.status === 'running' && data.startedAt != null) {
      const elapsed = Date.now() - data.startedAt
      if (elapsed >= data.delayMs) {
        record.status = data.outcome
        record.progress = 100
        await persistRecord(record)
        continue
      }
    }

    await runTestDelayJob(record, 'resume')
  }
}
