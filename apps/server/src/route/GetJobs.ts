import { Hono } from 'hono'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'
import { serializeJob, type GetJobData } from './serializeJob'

type GetJobsResponseBody =
  | { data: { jobs: GetJobData[] } }
  | { error: string }

export const getJobsRoute = new Hono().post('/api/get-jobs', async (c) => {
  try {
    const jobs = getCore().listJobs().map(serializeJob)
    const ok: GetJobsResponseBody = { data: { jobs } }
    return c.json<GetJobsResponseBody>(ok, 200)
  } catch (error) {
    logger.error({ error }, '[POST /api/get-jobs] route error')
    const err: GetJobsResponseBody = {
      error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
    return c.json<GetJobsResponseBody>(err, 200)
  }
})
