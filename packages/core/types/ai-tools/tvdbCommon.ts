import { z } from 'zod'

/** Optional TVDB ISO 639-3 language code (e.g. eng, zho, yue). */
export const tvdbLanguageSchema = z
  .string()
  .optional()
  .describe(
    'TVDB ISO 639-3 language code (e.g. eng, zho, yue). Defaults from userConfig.preferMediaLanguage.',
  )

/** Override TVDB API base URL (MCP/AI tool name: baseURL). */
export const tvdbBaseUrlSchema = z
  .string()
  .optional()
  .describe('Optional TVDB API base URL override (defaults from userConfig.tvdb.host)')

export interface TvdbToolHostOptions {
  language?: string
  baseURL?: string
}

export function toTvdbCoreOptions(params: TvdbToolHostOptions): {
  language?: string
  host?: string
} {
  const host = params.baseURL?.trim()
  return {
    language: params.language,
    host: host || undefined,
  }
}

export function formatTvdbToolError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.startsWith('Error Reason:') ? message : `Error Reason: ${message}`
}
