import { Hono } from 'hono'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

export type GetFoldersResponseBody =
  | { data: { folders: string[] } }
  | { error: string }

export const getFoldersRoute = new Hono().post('/api/get-folders', async (c) => {
  try {
    try {
      await c.req.json()
    } catch {
      /* empty body OK */
    }
    const folders = await getCore().getFolders()
    return c.json<GetFoldersResponseBody>({ data: { folders } }, 200)
  } catch (error) {
    logger.error({ error }, '[POST /api/get-folders] route error')
    return c.json<GetFoldersResponseBody>(
      { error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}` },
      200,
    )
  }
})
