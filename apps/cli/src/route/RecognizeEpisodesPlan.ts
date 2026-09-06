import type { Hono } from 'hono'
import { Path } from '@smm/utils/path'
import type { RecognizeMediaFilePlan } from '@smm/types/RecognizeMediaFilePlan'
import {
  RecognizeMediaFilePlanReady,
  type RecognizeMediaFilePlanReadyRequestData,
} from '@smm/types/event-types'
import { formatToolError } from '@smm/core/ai-tool/toolResult'
import { getCore } from '../core/getCore'
import { broadcast } from '@/utils/socketIO'
import { getAppDataDir } from '@/utils/config'
import { logger } from '../../lib/logger'

export interface CreateRecognizeEpisodePlanRequestBody {
  mediaFolderPath: string
  files: Array<{ season: number; episode: number; path: string }>
  creator?: 'ai' | 'app'
}

export interface CreateRecognizeEpisodePlanResponseBody {
  data?: { plan: RecognizeMediaFilePlan }
  error?: string
}

function readStringField(body: unknown, key: string): string | undefined {
  if (typeof body !== 'object' || body === null || !(key in body)) return undefined
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

function readRecognizeFiles(
  body: unknown,
): Array<{ season: number; episode: number; path: string }> | undefined {
  if (typeof body !== 'object' || body === null || !('files' in body)) return undefined
  const files = (body as Record<string, unknown>).files
  if (!Array.isArray(files)) return undefined
  if (
    !files.every(
      (file) =>
        typeof file === 'object' &&
        file !== null &&
        typeof (file as Record<string, unknown>).season === 'number' &&
        typeof (file as Record<string, unknown>).episode === 'number' &&
        typeof (file as Record<string, unknown>).path === 'string',
    )
  ) {
    return undefined
  }
  return files as Array<{ season: number; episode: number; path: string }>
}

export async function createRecognizeEpisodePlanFromBody(
  body: unknown,
): Promise<CreateRecognizeEpisodePlanResponseBody> {
  const mediaFolderPath = readStringField(body, 'mediaFolderPath')
  if (!mediaFolderPath?.trim()) {
    return { error: 'Error Reason: mediaFolderPath is required' }
  }

  const files = readRecognizeFiles(body)
  if (!files) {
    return { error: 'Error Reason: files must be an array' }
  }

  const creator = readStringField(body, 'creator') === 'app' ? 'app' : 'ai'
  const plan = await getCore().createRecognizeEpisodePlan(mediaFolderPath, files, { creator })

  if (creator === 'ai') {
    const planFilePath = Path.posix(`${getAppDataDir()}/plans/${plan.id}.plan.json`)
    const data: RecognizeMediaFilePlanReadyRequestData = {
      taskId: plan.id,
      planFilePath,
    }
    broadcast({ event: RecognizeMediaFilePlanReady.event, data })
  }

  return { data: { plan } }
}

/**
 * Recognize-episodes plan HTTP surface (single call):
 * - POST /api/create-recognize-episode-plan → Core.createRecognizeEpisodePlan
 * (apply/reject reuse POST /api/apply-plan and /api/reject-plan in RenameEpisodesPlan.ts)
 */
export function handleRecognizeEpisodesPlan(app: Hono): void {
  app.post('/api/create-recognize-episode-plan', async (c) => {
    try {
      let body: unknown = {}
      try {
        body = await c.req.json()
      } catch {
        /* empty */
      }
      return c.json(await createRecognizeEpisodePlanFromBody(body), 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/create-recognize-episode-plan] route error')
      const err: CreateRecognizeEpisodePlanResponseBody = formatToolError(error)
      return c.json(err, 200)
    }
  })
}
