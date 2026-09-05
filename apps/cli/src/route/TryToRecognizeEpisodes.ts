import type { Hono } from 'hono'
import type { RecognizeMediaFilePlan } from '@smm/types/RecognizeMediaFilePlan'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

export interface TryToRecognizeEpisodesRequestBody {
  mediaFolderPath: string
}

export interface TryToRecognizeEpisodesResponseBody {
  data?: { plan: RecognizeMediaFilePlan }
  error?: string
}

function readStringField(body: unknown, key: string): string | undefined {
  if (typeof body !== 'object' || body === null || !(key in body)) return undefined
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

/**
 * Recognize-episodes plan HTTP surface matching docs/dev/recognize-episodes.md:
 * - POST /api/try-to-recognize-episodes → Core.tryToRecognizeEpisodes
 * (apply/reject reuse POST /api/apply-plan and /api/reject-plan in RenameEpisodesPlan.ts)
 */
export function handleTryToRecognizeEpisodes(app: Hono): void {
  app.post('/api/try-to-recognize-episodes', async (c) => {
    try {
      let body: unknown = {}
      try {
        body = await c.req.json()
      } catch {
        /* empty */
      }

      const mediaFolderPath = readStringField(body, 'mediaFolderPath')
      if (!mediaFolderPath?.trim()) {
        const err: TryToRecognizeEpisodesResponseBody = {
          error: 'Error Reason: mediaFolderPath is required',
        }
        return c.json(err, 200)
      }

      const plan = await getCore().tryToRecognizeEpisodes(mediaFolderPath)
      const ok: TryToRecognizeEpisodesResponseBody = { data: { plan } }
      return c.json(ok, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/try-to-recognize-episodes] route error')
      const err: TryToRecognizeEpisodesResponseBody = {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      return c.json(err, 200)
    }
  })
}
