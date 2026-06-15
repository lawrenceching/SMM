import { z } from 'zod/v3'
import { logger } from '../../../lib/logger'
import { getMediaFoldersAgentTool } from '../../tools/getMediaFolders'
import type { GetMediaFoldersToolOutput } from '../../tools/getMediaFolders'
import type { Hono } from 'hono'

interface DebugGetMediaFoldersResponseBody {
  success: boolean
  data?: Omit<GetMediaFoldersToolOutput, 'error'>
  error?: string
}

const getMediaFoldersSchema = z.object({
  clientId: z.string().optional(),
})

export async function processGetMediaFolders(
  body: unknown,
): Promise<DebugGetMediaFoldersResponseBody> {
  try {
    const validationResult = getMediaFoldersSchema.safeParse(body ?? {})
    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map((i) => i.message).join(', ')}`,
      }
    }

    const { clientId = '' } = validationResult.data
    const tool = getMediaFoldersAgentTool(clientId)
    const result = (await tool.execute({})) as GetMediaFoldersToolOutput

    if (result.error) {
      const { error, ...data } = result
      return {
        success: false,
        data,
        error,
      }
    }

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to execute getMediaFolders tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

export function handleDebugGetMediaFoldersRoute(app: Hono) {
  app.post('/debug/getMediaFolders', async (c) => {
    try {
      let rawBody: unknown = {}
      try {
        rawBody = await c.req.json()
      } catch {
        rawBody = {}
      }
      const result = await processGetMediaFolders(rawBody)
      return c.json(result, 200)
    } catch (error) {
      logger.error({ error }, 'Debug API getMediaFolders route error:')
      return c.json(
        {
          success: false,
          error: `Failed to process getMediaFolders request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        500,
      )
    }
  })
}
