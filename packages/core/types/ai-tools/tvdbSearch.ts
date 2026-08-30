import { z } from 'zod'
import { tvdbBaseUrlSchema, tvdbLanguageSchema } from './tvdbCommon'

export const TVDB_SEARCH = 'tvdb-search' as const

export const TVDB_SEARCH_DESCRIPTION =
  'Search TVDB (TheTVDB) for TV series or movies by keyword. ' +
  'Returns matching results with title, overview, and TVDB ID.\n\n' +
  'Example: Search series matching "naruto".'

export const tvdbSearchInputSchema = z.object({
  keyword: z.string().describe('Search keyword'),
  type: z.enum(['series', 'movie']).describe('Media type to search'),
  language: tvdbLanguageSchema,
  baseURL: tvdbBaseUrlSchema,
})

export const tvdbSearchOutputSchema = z.object({
  results: z.array(z.record(z.string(), z.unknown())).optional(),
  error: z.string().optional(),
})

export type TvdbSearchInput = z.infer<typeof tvdbSearchInputSchema>
export type TvdbSearchOutput = z.infer<typeof tvdbSearchOutputSchema>
