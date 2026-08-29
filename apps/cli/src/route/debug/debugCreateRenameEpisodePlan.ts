import type { RenameFilesPlan } from '@core/types/RenameFilesPlan'
import type { Hono } from 'hono'
import { formatToolError } from '@core/ai-tool/toolResult'
import { logger } from '../../../lib/logger'
import { createRenameEpisodePlanFromBody } from '../RenameEpisodesPlan'

interface DebugCreateRenameEpisodePlanResponseBody {
  success: boolean
  data?: {
    planId: string
    plan: RenameFilesPlan
  }
  error?: string
}

export function handleDebugCreateRenameEpisodePlan(app: Hono): void {
  app.post('/debug/createRenameEpisodePlan', async (c) => {
    try {
      let body: unknown = {}
      try {
        body = await c.req.json()
      } catch {
        /* empty */
      }

      const result = await createRenameEpisodePlanFromBody(body)
      if (!result.data) {
        const response: DebugCreateRenameEpisodePlanResponseBody = {
          success: false,
          error: result.error,
        }
        return c.json(response, 200)
      }

      const response: DebugCreateRenameEpisodePlanResponseBody = {
        success: true,
        data: {
          planId: result.data.plan.id,
          plan: result.data.plan,
        },
      }
      return c.json(response, 200)
    } catch (error) {
      logger.error({ error }, '[POST /debug/createRenameEpisodePlan] route error')
      const response: DebugCreateRenameEpisodePlanResponseBody = {
        success: false,
        ...formatToolError(error),
      }
      return c.json(response, 200)
    }
  })
}
