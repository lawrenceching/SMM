import type { Hono } from 'hono'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

export interface GetFoldersResponseBody {
  data?: { folders: string[] }
  error?: string
}

export function handleGetFolders(app: Hono): void {
  app.post('/api/get-folders', async (c) => {
    try {
      // Body optional; tolerate missing/invalid JSON
      try {
        await c.req.json()
      } catch {
        /* empty body OK */
      }
      const folders = await getCore().getFolders()
      const body: GetFoldersResponseBody = { data: { folders } }
      return c.json(body, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/get-folders] route error')
      const body: GetFoldersResponseBody = {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      return c.json(body, 200)
    }
  })
}
