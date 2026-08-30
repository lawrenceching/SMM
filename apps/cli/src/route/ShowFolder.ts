import type { Hono } from 'hono'
import { logger } from '../../lib/logger'
import {
  resolveShowFolder,
  toShowFolderApiResult,
  type ShowFolderResult,
} from '../cli/folderDisplay'

export interface ShowFolderResponseBody {
  data?: ShowFolderResult
  error?: string
}

export function handleShowFolder(app: Hono): void {
  app.post('/api/show-folder', async (c) => {
    try {
      let body: unknown = {}
      try {
        body = await c.req.json()
      } catch {
        /* empty body */
      }
      const path =
        typeof body === 'object' && body !== null && 'path' in body
          ? (body as { path: unknown }).path
          : undefined
      if (typeof path !== 'string' || path.trim() === '') {
        const err: ShowFolderResponseBody = { error: 'Error Reason: path is required' }
        return c.json(err, 200)
      }
      const resolved = await resolveShowFolder(path)
      if (!resolved.ok) {
        const err: ShowFolderResponseBody = { error: `Error Reason: ${resolved.error}` }
        return c.json(err, 200)
      }
      const ok: ShowFolderResponseBody = { data: toShowFolderApiResult(resolved.result) }
      return c.json(ok, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/show-folder] route error')
      const err: ShowFolderResponseBody = {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      return c.json(err, 200)
    }
  })
}
