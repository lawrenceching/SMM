import { z } from 'zod/v3'
import type { Hono } from 'hono'
import { executeScrape } from '@smm/core-routes'
import type { ScrapeOutput } from '@smm/types/ai-tools/scrape'
import { getCore } from '../../core/getCore'
import { logger } from '../../../lib/logger'

interface DebugScrapeToolResponseBody {
  success: boolean
  data?: ScrapeOutput
  error?: string
}

const scrapeToolSchema = z.object({
  path: z.string().min(1, 'path is required'),
  language: z.string().optional(),
})

export async function processScrapeTool(
  body: unknown,
): Promise<DebugScrapeToolResponseBody> {
  try {
    const validationResult = scrapeToolSchema.safeParse(body ?? {})
    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map((i) => i.message).join(', ')}`,
      }
    }

    const result = await executeScrape(
      {
        path: validationResult.data.path,
        language: validationResult.data.language,
      },
      (path, options) => getCore().scrapeFolder(path, options),
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
      error: `Failed to execute scrape tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

export function handleDebugScrapeToolRoute(app: Hono) {
  app.post('/debug/scrapeTool', async (c) => {
    try {
      const rawBody = await c.req.json()
      const result = await processScrapeTool(rawBody)
      return c.json(result, 200)
    } catch (error) {
      logger.error({ error }, 'Debug API scrapeTool route error:')
      return c.json(
        {
          success: false,
          error: `Failed to process scrapeTool request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        500,
      )
    }
  })
}
