import { makeAssistantTool, tool } from '@assistant-ui/react'
import {
  SCRAPE,
  SCRAPE_DESCRIPTION,
  scrapeInputSchema,
  type ScrapeOutput,
} from '@core/types/ai-tools/scrape'
import { scrapeFailed, scrapeSucceeded } from '@core/ai-tool/scrapeResult'
import { formatToolError, requireNonEmptyString, toolOk } from '@core/ai-tool/toolResult'
import { scrapeFolderV3 } from '@/api/scrapeV3'

const scrapeTool = tool({
  description: SCRAPE_DESCRIPTION,
  parameters: scrapeInputSchema,
  execute: async ({ path, language }): Promise<ScrapeOutput> => {
    const pathCheck = requireNonEmptyString(path, 'path')
    if (typeof pathCheck !== 'string') {
      return scrapeFailed('', pathCheck.error)
    }

    try {
      const result = await scrapeFolderV3({
        path: pathCheck,
        language,
      })
      if (result.error) {
        return scrapeFailed(pathCheck, result.error)
      }
      if (!result.data?.id) {
        return scrapeFailed(pathCheck, 'Error Reason: scrape job id missing')
      }
      return toolOk(scrapeSucceeded(result.data.id))
    } catch (error) {
      return scrapeFailed(pathCheck, formatToolError(error).error)
    }
  },
})

export const ScrapeTool = makeAssistantTool({
  ...scrapeTool,
  toolName: SCRAPE,
})
