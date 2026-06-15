import { z } from 'zod/v3'
import type { Hono } from 'hono'
import { logger } from '../../lib/logger'
import { executeListFilesInMediaFolder } from '../tools/listFilesInMediaFolder'
import { createEmptyListFilesInMediaFolderData } from '@core/ai-tool/buildListFilesInMediaFolderResponse'

const requestSchema = z.object({
  mediaFolderPath: z
    .string()
    .min(1, 'The absolute path of the media folder is required'),
  recursively: z.boolean().optional(),
  videoFileOnly: z.boolean().optional(),
})

export async function processListFilesInMediaFolder(
  body: unknown,
  abortSignal?: AbortSignal,
) {
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(', ')
    return {
      ...createEmptyListFilesInMediaFolderData(),
      error: `Validation Failed: ${msg}`,
    }
  }

  try {
    return await executeListFilesInMediaFolder(parsed.data, abortSignal)
  } catch (error) {
    return {
      ...createEmptyListFilesInMediaFolderData(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
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
