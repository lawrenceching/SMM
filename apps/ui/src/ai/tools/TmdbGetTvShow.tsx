import { makeAssistantTool, tool } from '@assistant-ui/react'
import {
  TMDB_GET_TV_SHOW,
  TMDB_GET_TV_SHOW_DESCRIPTION,
  tmdbGetTvShowInputSchema,
  type TmdbGetTvShowOutput,
} from '@smm/types/ai-tools/tmdbGetTvShow'
import { formatToolError } from '@smm/core/ai-tool/toolResult'
import { getTvShowInTmdb } from '@/api/tmdbHttp'

const tmdbGetTvShowTool = tool({
  description: TMDB_GET_TV_SHOW_DESCRIPTION,
  parameters: tmdbGetTvShowInputSchema,
  execute: async ({ id, language, baseURL }): Promise<TmdbGetTvShowOutput> => {
    if (!Number.isInteger(id) || id <= 0) {
      return { error: "Invalid id: 'id' must be a positive integer" }
    }

    try {
      const body = await getTvShowInTmdb({ id, language, host: baseURL })
      if ('error' in body) {
        return { error: body.error }
      }
      return body.data as unknown as TmdbGetTvShowOutput
    } catch (error) {
      return { error: formatToolError(error).error }
    }
  },
})

export const TmdbGetTvShowTool = makeAssistantTool({
  ...tmdbGetTvShowTool,
  toolName: TMDB_GET_TV_SHOW,
})
