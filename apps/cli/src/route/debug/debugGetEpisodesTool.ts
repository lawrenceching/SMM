import { z } from 'zod/v3'
import { logger } from '../../../lib/logger'
import { getEpisodesAgentTool } from '../../tools/getEpisodes'
import type { GetEpisodesToolOutput } from '../../tools/getEpisodes'
import type { Hono } from 'hono'

interface DebugGetEpisodesToolResponseBody {
  success: boolean
  data?: Omit<GetEpisodesToolOutput, 'error'>
  error?: string
}

const getEpisodesToolSchema = z.object({
  mediaFolderPath: z.string().min(1, 'Media folder path is required'),
  clientId: z.string().optional(),
})

export async function processGetEpisodesTool(
  body: unknown,
): Promise<DebugGetEpisodesToolResponseBody> {
  try {
    const validationResult = getEpisodesToolSchema.safeParse(body ?? {})
    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map((i) => i.message).join(', ')}`,
      }
    }

    const { mediaFolderPath, clientId = '' } = validationResult.data
    const tool = getEpisodesAgentTool(clientId, undefined)
    const result = (await tool.execute({
      mediaFolderPath,
    })) as GetEpisodesToolOutput

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
      error: `Failed to execute getEpisodes tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

export function handleDebugGetEpisodesToolRoute(app: Hono) {
  app.post('/debug/getEpisodesTool', async (c) => {
    try {
      const rawBody = await c.req.json()
      const result = await processGetEpisodesTool(rawBody)
      return c.json(result, 200)
    } catch (error) {
      logger.error({ error }, 'Debug API getEpisodesTool route error:')
      return c.json(
        {
          success: false,
          error: `Failed to process getEpisodesTool request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        500,
      )
    }
  })
}
