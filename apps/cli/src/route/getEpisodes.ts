import type { Hono } from 'hono'
import { logger } from '../../lib/logger'
import {
  doGetEpisodes,
  type CoreRoutesLogger,
} from '@smm/core-routes'
import { createEmptyGetEpisodesData } from '@core/ai-tool/buildGetEpisodesResponse'
import { buildCoreRoutesConfig } from './coreRoutesConfig'

const coreRoutesLogger: CoreRoutesLogger = {
  debug: (obj, msg) => logger.debug(obj, msg),
  info: (obj, msg) => logger.info(obj, msg),
  warn: (obj, msg) => logger.warn(obj, msg),
  error: (obj, msg) => logger.error(obj, msg),
}

export async function processGetEpisodes(body: unknown, _abortSignal?: AbortSignal) {
  const config = await buildCoreRoutesConfig(coreRoutesLogger)
  return doGetEpisodes(body, config)
}

export function handleGetEpisodesRoute(app: Hono): void {
  app.post('/api/getEpisodes', async (c) => {
    try {
      const rawBody = await c.req.json()
      const abortSignal = c.req.raw.signal
      const result = await processGetEpisodes(rawBody, abortSignal)
      return c.json(result, 200)
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '[POST /api/getEpisodes] route error',
      )
      return c.json(
        {
          ...createEmptyGetEpisodesData(),
          error: `Unexpected Error: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        },
        200,
      )
    }
  })
}
