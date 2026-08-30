import type { Hono } from 'hono'
import type { Job } from '@smm/core'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

export interface GetJobResponseBody {
  data?: Job
  error?: string
}

export function handleGetJob(app: Hono): void {
  app.post('/api/get-job', async (c) => {
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
        return c.json(err, 200)
      }
      const job = getCore().getJob(id)
      if (job === undefined) {
        const err: GetJobResponseBody = { error: 'Error Reason: Job not found' }
        return c.json(err, 200)
      }
      const ok: GetJobResponseBody = { data: job }
      return c.json(ok, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/get-job] route error')
      const err: GetJobResponseBody = {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      return c.json(err, 200)
    }
  })
}
