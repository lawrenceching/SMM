import type { Hono } from 'hono'
import { Path } from '@smm/utils/path'
import { getCore } from '../core/getCore'
import { broadcast } from '@/utils/socketIO'
import { logger } from '../../lib/logger'

export interface RenameEpisodeFileRequestBody {
  mediaFolder: string
  from: string
  to: string
}

export interface RenameEpisodeFileResponseBody {
  data?: {
    succeeded: Array<{ from: string; to: string }>
    failed: Array<{ path: string; error: string }>
  }
  error?: string
}

/**
 * Layer-2 rename: POST /api/rename-episode-file → Core.renameEpisodeFile.
 * Broadcasts mediaMetadataUpdated on success (parity with /api/renameFiles).
 */
export function handleRenameEpisodeFile(app: Hono): void {
  app.post('/api/rename-episode-file', async (c) => {
    try {
      let body: unknown = {}
      try {
        body = await c.req.json()
      } catch {
        /* empty body */
      }

      const mediaFolder =
        typeof body === 'object' && body !== null && 'mediaFolder' in body
          ? (body as { mediaFolder: unknown }).mediaFolder
          : undefined
      const from =
        typeof body === 'object' && body !== null && 'from' in body
          ? (body as { from: unknown }).from
          : undefined
      const to =
        typeof body === 'object' && body !== null && 'to' in body
          ? (body as { to: unknown }).to
          : undefined

      if (typeof mediaFolder !== 'string' || mediaFolder.trim() === '') {
        const err: RenameEpisodeFileResponseBody = {
          error: 'Error Reason: mediaFolder is required',
        }
        return c.json(err, 200)
      }
      if (typeof from !== 'string' || from.trim() === '') {
        const err: RenameEpisodeFileResponseBody = {
          error: 'Error Reason: from is required',
        }
        return c.json(err, 200)
      }
      if (typeof to !== 'string' || to.trim() === '') {
        const err: RenameEpisodeFileResponseBody = {
          error: 'Error Reason: to is required',
        }
        return c.json(err, 200)
      }

      const clientId = c.req.header('clientId')
      const result = await getCore().renameEpisodeFile({
        mediaFolderPath: mediaFolder,
        from,
        to,
      })

      if (result.succeeded.length > 0) {
        broadcast({
          clientId: clientId ?? undefined,
          event: 'mediaMetadataUpdated',
          data: {
            folderPath: Path.posix(mediaFolder),
          },
        })
      }

      const ok: RenameEpisodeFileResponseBody = { data: result }
      return c.json(ok, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/rename-episode-file] route error')
      const err: RenameEpisodeFileResponseBody = {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      return c.json(err, 200)
    }
  })
}
