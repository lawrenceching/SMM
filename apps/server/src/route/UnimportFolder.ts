import { Hono } from 'hono'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

type UnimportFolderResponseBody =
  | { data: { path: string } }
  | { error: string }

export const unimportFolderRoute = new Hono().post('/api/unimport-folder', async (c) => {
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
      return c.json<UnimportFolderResponseBody>(err, 200)
    }
    await getCore().unimportFolder(path)
    const ok: UnimportFolderResponseBody = { data: { path } }
    return c.json<UnimportFolderResponseBody>(ok, 200)
  } catch (error) {
    logger.error({ error }, '[POST /api/unimport-folder] route error')
    const err: UnimportFolderResponseBody = {
      error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
    return c.json<UnimportFolderResponseBody>(err, 200)
  }
})
