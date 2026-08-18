import type { Hono } from 'hono'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

export interface UnimportFolderResponseBody {
  data?: { path: string }
  error?: string
}

export function handleUnimportFolder(app: Hono): void {
  app.post('/api/unimport-folder', async (c) => {
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
        const err: UnimportFolderResponseBody = {
          error: 'Error Reason: path is required',
        }
        return c.json(err, 200)
      }
      await getCore().unimportFolder(path)
      const ok: UnimportFolderResponseBody = { data: { path } }
      return c.json(ok, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/unimport-folder] route error')
      const err: UnimportFolderResponseBody = {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      return c.json(err, 200)
    }
  })
}
