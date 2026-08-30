import { z } from 'zod'
import { tvdbBaseUrlSchema } from './tvdbCommon'

export const TVDB_GET_LANGUAGES = 'tvdb-get-languages' as const

export const TVDB_GET_LANGUAGES_DESCRIPTION =
  'Retrieve the list of TVDB supported languages (ISO 639-3 codes). Useful for picking a search language.'

export const tvdbGetLanguagesInputSchema = z.object({
  baseURL: tvdbBaseUrlSchema,
})

export const tvdbGetLanguagesOutputSchema = z.object({
  languages: z.array(z.record(z.string(), z.unknown())).optional(),
  error: z.string().optional(),
})

export type TvdbGetLanguagesInput = z.infer<typeof tvdbGetLanguagesInputSchema>
export type TvdbGetLanguagesOutput = z.infer<typeof tvdbGetLanguagesOutputSchema>
