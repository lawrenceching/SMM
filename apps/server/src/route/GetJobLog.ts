import { Hono } from 'hono'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

type GetJobLogResponseBody =
  | { data: { lines: { message: string }[] } }
  | { error: string }

const BUSINESS_JOB_ERRORS = new Set([
  'Job not found',
  'Job is not abortable',
  'Job already finished',
])

export const getJobLogRoute = new Hono().post('/api/get-job-log', async (c) => {
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
      return c.json<GetJobLogResponseBody>(err, 200)
    }
    const text = await getCore().getJobLog(id)
    const lines = text
      .split('\n')
      .filter((line) => line.length > 0)
      .map((message) => ({ message }))
    return c.json<GetJobLogResponseBody>({ data: { lines } }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (!BUSINESS_JOB_ERRORS.has(message)) {
      logger.error({ error }, '[POST /api/get-job-log] route error')
    }
    return c.json<GetJobLogResponseBody>(
      { error: `Error Reason: ${message}` },
      200,
    )
  }
})
