import { z } from 'zod'
import { tmdbBaseUrlSchema, tmdbLanguageSchema } from './tmdbCommon'

export const TMDB_GET_TV_SHOW = 'tmdb-get-tv-show' as const

export const TMDB_GET_TV_SHOW_DESCRIPTION =
  'Retrieve detailed TV show information from TMDB by TMDB ID, including seasons and episodes ' +
  'with titles, overviews, and air dates.\n\n' +
  'Example: Get TV show details for TMDB id 31917.'

export const tmdbGetTvShowInputSchema = z.object({
  id: z.number().int().positive().describe('TMDB TV series id'),
  language: tmdbLanguageSchema,
  baseURL: tmdbBaseUrlSchema,
})

export const tmdbGetTvShowOutputSchema = z
  .object({
    error: z.string().optional(),
  })
  .passthrough()

export type TmdbGetTvShowInput = z.infer<typeof tmdbGetTvShowInputSchema>
export type TmdbGetTvShowOutput = z.infer<typeof tmdbGetTvShowOutputSchema>
