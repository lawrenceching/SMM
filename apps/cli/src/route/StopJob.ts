import type { Hono } from 'hono'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

interface StopJobResponseBody {
  data?: { id: string }
  error?: string
}

export function handleStopJob(app: Hono): void {
  app.post('/api/stop-job', async (c) => {
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
        const err: StopJobResponseBody = { error: 'Error Reason: id is required' }
        return c.json(err, 200)
      }
      getCore().stopJob(id)
      const ok: StopJobResponseBody = { data: { id } }
      return c.json(ok, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/stop-job] route error')
      const err: StopJobResponseBody = {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      return c.json(err, 200)
    }
  })
}
