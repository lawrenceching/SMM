import { z } from 'zod'
import { tvdbBaseUrlSchema, tvdbLanguageSchema } from './tvdbCommon'

export const TVDB_GET_TV_SHOW = 'tvdb-get-tv-show' as const

export const TVDB_GET_TV_SHOW_DESCRIPTION =
  'Retrieve TV series metadata from TVDB by TVDB ID, including seasons and episodes with localized titles.\n\n' +
  'Example: Get TV series metadata for TVDB id 42.'

export const tvdbGetTvShowInputSchema = z.object({
  id: z.number().int().positive().describe('TVDB series id'),
  language: tvdbLanguageSchema,
  baseURL: tvdbBaseUrlSchema,
})

export const tvdbGetTvShowOutputSchema = z
  .object({ error: z.string().optional() })
  .passthrough()

export type TvdbGetTvShowInput = z.infer<typeof tvdbGetTvShowInputSchema>
export type TvdbGetTvShowOutput = z.infer<typeof tvdbGetTvShowOutputSchema>
