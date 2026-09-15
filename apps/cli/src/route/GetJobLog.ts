import type { Hono } from 'hono'
import type { JobLogLine } from '@smm/core'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

interface GetJobLogResponseBody {
  data?: { lines: JobLogLine[] }
  error?: string
}

const BUSINESS_JOB_ERRORS = new Set([
  'Job not found',
  'Job is not abortable',
  'Job already finished',
])

export function handleGetJobLog(app: Hono): void {
  app.post('/api/get-job-log', async (c) => {
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
        const err: GetJobLogResponseBody = { error: 'Error Reason: id is required' }
        return c.json(err, 200)
      }
      const lines = getCore().getJobLog(id)
      return c.json({ data: { lines } }, 200)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (!BUSINESS_JOB_ERRORS.has(message)) {
        logger.error({ error }, '[POST /api/get-job-log] route error')
      }
      return c.json(
        {
          error: `Error Reason: ${message}`,
        },
        200,
      )
    }
  })
}
