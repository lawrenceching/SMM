import { z } from 'zod/v3'
import type { Hono } from 'hono'
import { executeGetJob } from '@smm/core-routes'
import type { GetJobOutput } from '@smm/types/ai-tools/getJob'
import { getCore } from '../../core/getCore'
import { logger } from '../../../lib/logger'

interface DebugGetJobToolResponseBody {
  success: boolean
  data?: GetJobOutput
  error?: string
}

const getJobToolSchema = z.object({
  id: z.string().min(1, 'id is required'),
})

export async function processGetJobTool(
  body: unknown,
): Promise<DebugGetJobToolResponseBody> {
  try {
    const validationResult = getJobToolSchema.safeParse(body ?? {})
    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map((i) => i.message).join(', ')}`,
      }
    }

    const result = await executeGetJob(validationResult.data.id, (id) =>
      getCore().getJob(id),
    )

    if (result.error) {
      return {
        success: false,
        data: result,
        error: result.error,
      }
    }

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to execute get-job tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

export function handleDebugGetJobToolRoute(app: Hono) {
  app.post('/debug/getJobTool', async (c) => {
    try {
      const rawBody = await c.req.json()
      const result = await processGetJobTool(rawBody)
      return c.json(result, 200)
    } catch (error) {
      logger.error({ error }, 'Debug API getJobTool route error:')
      return c.json(
        {
          success: false,
          error: `Failed to process getJobTool request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        500,
      )
    }
  })
}
