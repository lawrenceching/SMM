import { Hono } from 'hono'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'
import { serializeJob, type GetJobData } from './serializeJob'

type GetJobResponseBody =
  | { data: GetJobData }
  | { error: string }

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
