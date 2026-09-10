import { Path } from '@smm/utils/path'
import type { FolderRenameRequestBody, FolderRenameResponseBody } from '@smm/types'
import {
  doRenameFolder as doRenameFolderCore,
  type CoreRoutesLogger,
} from '@smm/core-routes'
import type { Hono } from 'hono'
import { getCore } from '../core/getCore'
import { broadcastUserConfigFolderRenamedEvent } from '@/events/userConfigUpdatedEvent'
import { broadcast } from '@/utils/socketIO'
import { logger } from '../../lib/logger'
import { buildCoreRoutesConfig } from './coreRoutesConfig'

const coreRoutesLogger: CoreRoutesLogger = {
  debug: (obj, msg) => logger.debug(obj, msg),
  info: (obj, msg) => logger.info(obj, msg),
  warn: (obj, msg) => logger.warn(obj, msg),
  error: (obj, msg) => logger.error(obj, msg),
}

interface RenameFolderHttpResponseBody {
  data?: { from: string; to: string }
  error?: string
}

/**
 * In-process rename used by MCP / debug tools (core-routes `doRenameFolder`).
 */
export async function doRenameFolder(
  body: FolderRenameRequestBody,
  clientId?: string,
): Promise<FolderRenameResponseBody> {
  const config = await buildCoreRoutesConfig(coreRoutesLogger)
  const result = await doRenameFolderCore(body, config)

  if (!result.error) {
    const fromAsPosix = Path.posix(body.from)
    const toAsPosix = Path.posix(body.to)

    broadcastUserConfigFolderRenamedEvent({
      from: Path.toPlatformPath(fromAsPosix),
      to: Path.toPlatformPath(toAsPosix),
    })

    broadcast({
      clientId,
      event: 'userConfigUpdated',
      data: {},
    })
  }

  return result
}

/**
 * `POST /api/rename-folder` → `Core.renameFolder`.
 * Broadcasts folder-renamed / userConfigUpdated so UI listeners stay in sync.
 */
export function handleRenameFolder(app: Hono): void {
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
        const err: RenameFolderHttpResponseBody = {
          error: 'Error Reason: from is required',
        }
        return c.json(err, 200)
      }
      if (typeof to !== 'string' || to.trim() === '') {
        const err: RenameFolderHttpResponseBody = {
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

      const ok: RenameFolderHttpResponseBody = { data: { from, to } }
      return c.json(ok, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/rename-folder] route error')
      const err: RenameFolderHttpResponseBody = {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      return c.json(err, 200)
    }
  })
}
