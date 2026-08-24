import { makeAssistantTool, tool } from '@assistant-ui/react'
import {
  TMDB_GET_MOVIE,
  TMDB_GET_MOVIE_DESCRIPTION,
  tmdbGetMovieInputSchema,
  type TmdbGetMovieOutput,
} from '@core/types/ai-tools/tmdbGetMovie'
import { formatToolError } from '@core/ai-tool/toolResult'
import { getMovieInTmdb } from '@/api/tmdbV3'

const tmdbGetMovieTool = tool({
  description: TMDB_GET_MOVIE_DESCRIPTION,
  parameters: tmdbGetMovieInputSchema,
  execute: async ({ id, language, baseURL }): Promise<TmdbGetMovieOutput> => {
    if (!Number.isInteger(id) || id <= 0) {
      return { error: "Invalid id: 'id' must be a positive integer" }
    }

    try {
      const body = await getMovieInTmdb({ id, language, host: baseURL })
      if (body.error) {
        return { error: body.error }
      }
      if (!body.data) {
        return { error: 'Error Reason: empty movie result' }
      }
      return body.data as unknown as TmdbGetMovieOutput
    } catch (error) {
      return { error: formatToolError(error).error }
    }
  },
})

export const TmdbGetMovieTool = makeAssistantTool({
  ...tmdbGetMovieTool,
  toolName: TMDB_GET_MOVIE,
})
