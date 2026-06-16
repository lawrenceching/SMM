import type { Hono } from 'hono'
import { logger } from '../../lib/logger'
import {
  doListFilesInMediaFolder,
  type CoreRoutesLogger,
} from '@smm/core-routes'
import { createEmptyListFilesInMediaFolderData } from '@core/ai-tool/buildListFilesInMediaFolderResponse'
import { buildCoreRoutesConfig } from './coreRoutesConfig'

const coreRoutesLogger: CoreRoutesLogger = {
  debug: (obj, msg) => logger.debug(obj, msg),
  info: (obj, msg) => logger.info(obj, msg),
  warn: (obj, msg) => logger.warn(obj, msg),
  error: (obj, msg) => logger.error(obj, msg),
}

export async function processListFilesInMediaFolder(
  body: unknown,
  _abortSignal?: AbortSignal,
) {
  const config = await buildCoreRoutesConfig(coreRoutesLogger)
  return doListFilesInMediaFolder(body, config)
}

export function handleListFilesInMediaFolderRoute(app: Hono): void {
  app.post('/api/listFilesInMediaFolder', async (c) => {
    try {
      const rawBody = await c.req.json()
      const abortSignal = c.req.raw.signal
      const result = await processListFilesInMediaFolder(rawBody, abortSignal)
      return c.json(result, 200)
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '[POST /api/listFilesInMediaFolder] route error',
      )
      return c.json(
        {
          ...createEmptyListFilesInMediaFolderData(),
          error: `Unexpected Error: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        },
        200,
      )
    }
  })
}
