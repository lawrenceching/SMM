import { makeAssistantTool, tool } from '@assistant-ui/react'
import {
  TMDB_SEARCH,
  TMDB_SEARCH_DESCRIPTION,
  tmdbSearchInputSchema,
  type TmdbSearchOutput,
} from '@core/types/ai-tools/tmdbSearch'
import { formatToolError, requireNonEmptyString } from '@core/ai-tool/toolResult'
import { searchInTmdb } from '@/api/tmdbV3'

const tmdbSearchTool = tool({
  description: TMDB_SEARCH_DESCRIPTION,
  parameters: tmdbSearchInputSchema,
  execute: async ({ keyword, type, language, baseURL }): Promise<TmdbSearchOutput> => {
    const keywordCheck = requireNonEmptyString(keyword, 'keyword')
    if (typeof keywordCheck !== 'string') {
      return { error: keywordCheck.error }
    }

    try {
      const body = await searchInTmdb({
        keyword: keywordCheck,
        type,
        language,
        host: baseURL,
      })
      if (body.error) {
        return { error: body.error }
      }
      if (!body.data) {
        return { error: 'Error Reason: empty search result' }
      }
      if (body.data.error) {
        return { error: body.data.error }
      }
      return {
        results: body.data.results as unknown as Record<string, unknown>[],
        page: body.data.page,
        total_pages: body.data.total_pages,
        total_results: body.data.total_results,
      }
    } catch (error) {
      return { error: formatToolError(error).error }
    }
  },
})

export const TmdbSearchTool = makeAssistantTool({
  ...tmdbSearchTool,
  toolName: TMDB_SEARCH,
})
