import { z } from 'zod/v3'
import type { Hono } from 'hono'
import { logger } from '../../lib/logger'
import { executeGetEpisodes } from '../tools/getEpisodes'
import { createEmptyGetEpisodesData } from '@core/ai-tool/buildGetEpisodesResponse'

const requestSchema = z.object({
  mediaFolderPath: z
    .string()
    .min(1, 'The absolute path of the media folder is required'),
})

export async function processGetEpisodes(body: unknown, abortSignal?: AbortSignal) {
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(', ')
    return {
      ...createEmptyGetEpisodesData(),
      error: `Validation Failed: ${msg}`,
    }
  }

  try {
    const result = await executeGetEpisodes(
      { mediaFolderPath: parsed.data.mediaFolderPath },
      abortSignal,
    )
    return result
  } catch (error) {
    return {
      ...createEmptyGetEpisodesData(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
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
