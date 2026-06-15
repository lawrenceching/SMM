import { z } from 'zod/v3'
import { logger } from '../../../lib/logger'
import { listFilesInMediaFolderAgentTool } from '../../tools/listFilesInMediaFolder'
import type { ListFilesInMediaFolderToolOutput } from '../../tools/listFilesInMediaFolder'
import type { Hono } from 'hono'

interface DebugListFilesToolResponseBody {
  success: boolean
  data?: Omit<ListFilesInMediaFolderToolOutput, 'error'>
  error?: string
}

const listFilesToolSchema = z.object({
  mediaFolderPath: z.string().min(1, 'Media folder path is required'),
  recursively: z.boolean().optional(),
  videoFileOnly: z.boolean().optional(),
  clientId: z.string().optional(),
})

export async function processListFilesTool(
  body: unknown,
): Promise<DebugListFilesToolResponseBody> {
  try {
    const validationResult = listFilesToolSchema.safeParse(body ?? {})
    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map((i) => i.message).join(', ')}`,
      }
    }

    const { clientId = '', ...args } = validationResult.data
    const tool = listFilesInMediaFolderAgentTool(clientId)
    const result = (await tool.execute(args)) as ListFilesInMediaFolderToolOutput

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
      error: `Failed to execute listFiles tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

export function handleDebugListFilesToolRoute(app: Hono) {
  app.post('/debug/listFilesTool', async (c) => {
    try {
      const rawBody = await c.req.json()
      const result = await processListFilesTool(rawBody)
      return c.json(result, 200)
    } catch (error) {
      logger.error({ error }, 'Debug API listFilesTool route error:')
      return c.json(
        {
          success: false,
          error: `Failed to process listFilesTool request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        500,
      )
    }
  })
}
