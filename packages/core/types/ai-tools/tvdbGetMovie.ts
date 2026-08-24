import { z } from 'zod'
import { tvdbBaseUrlSchema, tvdbLanguageSchema } from './tvdbCommon'

export const TVDB_GET_MOVIE = 'tvdb-get-movie' as const

export const TVDB_GET_MOVIE_DESCRIPTION =
  'Retrieve movie metadata from TVDB by TVDB ID, including the localized title.\n\n' +
  'Example: Get movie metadata for TVDB id 7.'

export const tvdbGetMovieInputSchema = z.object({
  id: z.number().int().positive().describe('TVDB movie id'),
  language: tvdbLanguageSchema,
  baseURL: tvdbBaseUrlSchema,
})

export const tvdbGetMovieOutputSchema = z
  .object({ error: z.string().optional() })
  .passthrough()

export type TvdbGetMovieInput = z.infer<typeof tvdbGetMovieInputSchema>
export type TvdbGetMovieOutput = z.infer<typeof tvdbGetMovieOutputSchema>
