import type { Hono } from 'hono'
import { Path } from '@core/path'
import type { Plan } from 'core-app'
import type { RenameFilesPlan } from '@core/types/RenameFilesPlan'
import {
  RenameFilesPlanReady,
  type RenameFilesPlanReadyRequestData,
} from '@core/event-types'
import { formatToolError } from '@core/ai-tool/toolResult'
import { getCore } from '../core/getCore'
import { broadcast } from '@/utils/socketIO'
import { getUserDataDir } from '@/utils/config'
import { logger } from '../../lib/logger'

export interface TryToRenameEpisodesRequestBody {
  mediaFolderPath: string
  rule?: 'plex' | 'emby'
}

export interface TryToRenameEpisodesResponseBody {
  data?: { plan: RenameFilesPlan }
  error?: string
}

export interface CreateRenameEpisodePlanRequestBody {
  mediaFolderPath: string
  files: Array<{ from: string; to: string }>
  creator?: 'ai' | 'app'
}

export interface CreateRenameEpisodePlanResponseBody {
  data?: { plan: RenameFilesPlan }
  error?: string
}

export interface ApplyPlanRequestBody {
  id: string
}

export interface ApplyPlanResponseBody {
  data?: { id: string }
  error?: string
}

export interface RejectPlanRequestBody {
  id: string
}

export interface RejectPlanResponseBody {
  data?: { plan: Plan }
  error?: string
}

function readStringField(body: unknown, key: string): string | undefined {
  if (typeof body !== 'object' || body === null || !(key in body)) return undefined
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

function readRenameFiles(
  body: unknown,
): Array<{ from: string; to: string }> | undefined {
  if (typeof body !== 'object' || body === null || !('files' in body)) return undefined
  const files = (body as Record<string, unknown>).files
  if (!Array.isArray(files)) return undefined
  if (
    !files.every(
      (file) =>
        typeof file === 'object' &&
        file !== null &&
        typeof (file as Record<string, unknown>).from === 'string' &&
        typeof (file as Record<string, unknown>).to === 'string',
    )
  ) {
    return undefined
  }
  return files as Array<{ from: string; to: string }>
}

export async function createRenameEpisodePlanFromBody(
  body: unknown,
): Promise<CreateRenameEpisodePlanResponseBody> {
  const mediaFolderPath = readStringField(body, 'mediaFolderPath')
  if (!mediaFolderPath?.trim()) {
    return { error: 'Error Reason: mediaFolderPath is required' }
  }

  const files = readRenameFiles(body)
  if (!files) {
    return { error: 'Error Reason: files must be an array' }
  }

  const creator = readStringField(body, 'creator') === 'app' ? 'app' : 'ai'
  const plan = await getCore().createRenameEpisodePlan(mediaFolderPath, files, { creator })

  if (creator === 'ai') {
    const planFilePath = Path.posix(`${getUserDataDir()}/plans/${plan.id}.plan.json`)
    const data: RenameFilesPlanReadyRequestData = {
      taskId: plan.id,
      planFilePath,
    }
    broadcast({ event: RenameFilesPlanReady.event, data })
  }

  return { data: { plan } }
}

/**
 * Rename-episodes plan HTTP surface matching docs/dev/rename-episodes.md:
 * - POST /api/try-to-rename-episodes → Core.tryToRenameFolder
 * - POST /api/apply-plan → Core.applyPlan
 * - POST /api/reject-plan → Core.rejectPlan
 */
export function handleRenameEpisodesPlan(app: Hono): void {
  app.post('/api/create-rename-episode-plan', async (c) => {
    try {
      let body: unknown = {}
      try {
        body = await c.req.json()
      } catch {
        /* empty */
      }
      return c.json(await createRenameEpisodePlanFromBody(body), 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/create-rename-episode-plan] route error')
      const err: CreateRenameEpisodePlanResponseBody = formatToolError(error)
      return c.json(err, 200)
    }
  })

  app.post('/api/try-to-rename-episodes', async (c) => {
    try {
      let body: unknown = {}
      try {
        body = await c.req.json()
      } catch {
        /* empty */
      }

      const mediaFolderPath = readStringField(body, 'mediaFolderPath')
      if (!mediaFolderPath?.trim()) {
        const err: TryToRenameEpisodesResponseBody = {
          error: 'Error Reason: mediaFolderPath is required',
        }
        return c.json(err, 200)
      }

      const ruleRaw = readStringField(body, 'rule')
      const rule =
        ruleRaw === 'plex' || ruleRaw === 'emby' || ruleRaw === undefined
          ? ruleRaw
          : undefined
      if (ruleRaw !== undefined && rule === undefined) {
        const err: TryToRenameEpisodesResponseBody = {
          error: `Error Reason: Unsupported rename rule: ${ruleRaw}`,
        }
        return c.json(err, 200)
      }

      const plan = await getCore().tryToRenameFolder(mediaFolderPath, rule)
      const ok: TryToRenameEpisodesResponseBody = { data: { plan } }
      return c.json(ok, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/try-to-rename-episodes] route error')
      const err: TryToRenameEpisodesResponseBody = {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      return c.json(err, 200)
    }
  })

  app.post('/api/apply-plan', async (c) => {
    try {
      let body: unknown = {}
      try {
        body = await c.req.json()
      } catch {
        /* empty */
      }

      const id = readStringField(body, 'id')
      if (!id?.trim()) {
        const err: ApplyPlanResponseBody = { error: 'Error Reason: id is required' }
        return c.json(err, 200)
      }

      const clientId = c.req.header('clientId')
      const plan = await getCore().getPlan(id)
      await getCore().applyPlan(plan)

      if (plan.task === 'rename-files') {
        broadcast({
          clientId: clientId ?? undefined,
          event: 'mediaMetadataUpdated',
          data: { folderPath: Path.posix(plan.mediaFolderPath) },
        })
      }

      const ok: ApplyPlanResponseBody = { data: { id: plan.id } }
      return c.json(ok, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/apply-plan] route error')
      const err: ApplyPlanResponseBody = {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      return c.json(err, 200)
    }
  })

  app.post('/api/reject-plan', async (c) => {
    try {
      let body: unknown = {}
      try {
        body = await c.req.json()
      } catch {
        /* empty */
      }

      const id = readStringField(body, 'id')
      if (!id?.trim()) {
        const err: RejectPlanResponseBody = { error: 'Error Reason: id is required' }
        return c.json(err, 200)
      }

      const plan = await getCore().rejectPlan(id)
      const ok: RejectPlanResponseBody = { data: { plan } }
      return c.json(ok, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/reject-plan] route error')
      const err: RejectPlanResponseBody = {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      return c.json(err, 200)
    }
  })
}
