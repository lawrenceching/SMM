import { Hono } from 'hono'
import { ImportFolderJob, ImportLibraryJob, ScrapeJob, type Job } from '@smm/core'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

type GetJobData = Job | {
  id: string
  type: string
  status: string
  progress: number
  logFilePath: string
}

type GetJobResponseBody =
  | { data: GetJobData }
  | { error: string }

function serializeJob(job: NonNullable<ReturnType<ReturnType<typeof getCore>['getJob']>>) {
  if (job instanceof ScrapeJob) {
    return job.toJSON()
  }
  if (job instanceof ImportFolderJob) {
    return job.toJSON()
  }
  if (job instanceof ImportLibraryJob) {
    return job.toJSON()
  }
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    progress: job.progress(),
    logFilePath: job.logFilePath,
  }
}

export const getJobRoute = new Hono().post('/api/get-job', async (c) => {
  try {
    let body: unknown = {}
    try {
      body = await c.req.json()
    } catch {
      /* empty body */
    }
    const id =
      typeof body === 'object' && body !== null && 'id' in body
        ? (body as { id: unknown }).id
        : undefined
    if (typeof id !== 'string' || id.trim() === '') {
      const err: GetJobResponseBody = { error: 'Error Reason: id is required' }
      return c.json<GetJobResponseBody>(err, 200)
    }
    const job = getCore().getJob(id)
    if (job === undefined) {
      const err: GetJobResponseBody = { error: 'Error Reason: Job not found' }
      return c.json<GetJobResponseBody>(err, 200)
    }
    const ok: GetJobResponseBody = { data: serializeJob(job) }
    return c.json<GetJobResponseBody>(ok, 200)
  } catch (error) {
    logger.error({ error }, '[POST /api/get-job] route error')
    const err: GetJobResponseBody = {
      error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
    return c.json<GetJobResponseBody>(err, 200)
  }
})
