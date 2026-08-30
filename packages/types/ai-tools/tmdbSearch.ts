import { z } from 'zod'
import { tmdbBaseUrlSchema, tmdbLanguageSchema } from './tmdbCommon'

export const TMDB_SEARCH = 'tmdb-search' as const

export const TMDB_SEARCH_DESCRIPTION =
  'Search TMDB (The Movie Database) for movies or TV shows by keyword. ' +
  'Returns matching results with title, release date, overview, and TMDB ID.\n\n' +
  'Example: Search TV shows matching "naruto".'

export const tmdbSearchInputSchema = z.object({
  keyword: z.string().describe('Search keyword'),
  type: z.enum(['tv', 'movie']).describe('Media type to search'),
  language: tmdbLanguageSchema,
  baseURL: tmdbBaseUrlSchema,
})

export const tmdbSearchOutputSchema = z.object({
  results: z.array(z.record(z.string(), z.unknown())).optional(),
  page: z.number().optional(),
  total_pages: z.number().optional(),
  total_results: z.number().optional(),
  error: z.string().optional(),
})

export type TmdbSearchInput = z.infer<typeof tmdbSearchInputSchema>
export type TmdbSearchOutput = z.infer<typeof tmdbSearchOutputSchema>
