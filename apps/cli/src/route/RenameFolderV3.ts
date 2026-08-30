import { Path } from '@smm/utils/path'
import type { Hono } from 'hono'
import { getCore } from '../core/getCore'
import { broadcastUserConfigFolderRenamedEvent } from '@/events/userConfigUpdatedEvent'
import { broadcast } from '@/utils/socketIO'
import { logger } from '../../lib/logger'

export interface RenameFolderV3RequestBody {
  from: string
  to: string
}

export interface RenameFolderV3ResponseBody {
  data?: { from: string; to: string }
  error?: string
}

/**
 * Layer-2 rename: POST /api/rename-folder → Core.renameFolder.
 * Keeps socket broadcasts so UI listeners stay in sync (parity with legacy /api/renameFolder).
 */
export function handleRenameFolderV3(app: Hono): void {
  app.post('/api/rename-folder', async (c) => {
    try {
      let body: unknown = {}
      try {
        body = await c.req.json()
      } catch {
        /* empty body */
      }

      const from =
        typeof body === 'object' && body !== null && 'from' in body
          ? (body as { from: unknown }).from
          : undefined
      const to =
        typeof body === 'object' && body !== null && 'to' in body
          ? (body as { to: unknown }).to
          : undefined

      if (typeof from !== 'string' || from.trim() === '') {
        const err: RenameFolderV3ResponseBody = {
          error: 'Error Reason: from is required',
        }
        return c.json(err, 200)
      }
      if (typeof to !== 'string' || to.trim() === '') {
        const err: RenameFolderV3ResponseBody = {
          error: 'Error Reason: to is required',
        }
        return c.json(err, 200)
      }

      const clientId = c.req.header('clientId')
      logger.info(
        `[HTTP_IN] ${c.req.method} ${c.req.url} ${from} -> ${to} (clientId: ${clientId || 'not provided'})`,
      )

      await getCore().renameFolder({ from, to })

      const fromAsPosix = Path.posix(from)
      const toAsPosix = Path.posix(to)
      broadcastUserConfigFolderRenamedEvent({
        from: Path.toPlatformPath(fromAsPosix),
        to: Path.toPlatformPath(toAsPosix),
      })
      broadcast({
        clientId: clientId ?? undefined,
        event: 'userConfigUpdated',
        data: {},
      })

      const ok: RenameFolderV3ResponseBody = { data: { from, to } }
      return c.json(ok, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/rename-folder] route error')
      const err: RenameFolderV3ResponseBody = {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      return c.json(err, 200)
    }
  })
}
