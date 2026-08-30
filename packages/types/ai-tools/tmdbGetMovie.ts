import { z } from 'zod'
import { tmdbBaseUrlSchema, tmdbLanguageSchema } from './tmdbCommon'

export const TMDB_GET_MOVIE = 'tmdb-get-movie' as const

export const TMDB_GET_MOVIE_DESCRIPTION =
  'Retrieve detailed movie information from TMDB by TMDB ID. ' +
  'Includes title, overview, release date, runtime, genres, poster images, and more.\n\n' +
  'Example: Get movie details for TMDB id 550.'

export const tmdbGetMovieInputSchema = z.object({
  id: z.number().int().positive().describe('TMDB movie id'),
  language: tmdbLanguageSchema,
  baseURL: tmdbBaseUrlSchema,
})

export const tmdbGetMovieOutputSchema = z
  .object({
    error: z.string().optional(),
  })
  .passthrough()

export type TmdbGetMovieInput = z.infer<typeof tmdbGetMovieInputSchema>
export type TmdbGetMovieOutput = z.infer<typeof tmdbGetMovieOutputSchema>
