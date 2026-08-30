import { z } from 'zod'

/** Optional TMDB primary translation tag (e.g. zh-CN, en-US). */
export const tmdbLanguageSchema = z
  .string()
  .optional()
  .describe(
    'TMDB primary translation IETF tag (e.g. zh-CN, en-US). Defaults from userConfig.preferMediaLanguage.',
  )

/** Override TMDB API base URL (MCP/AI tool name: baseURL). */
export const tmdbBaseUrlSchema = z
  .string()
  .optional()
  .describe('Optional TMDB API base URL override (defaults from userConfig.tmdb.host)')

export interface TmdbToolHostOptions {
  language?: string
  baseURL?: string
}

export function toTmdbCoreOptions(params: TmdbToolHostOptions): {
  language?: string
  host?: string
} {
  const host = params.baseURL?.trim()
  return {
    language: params.language,
    host: host || undefined,
  }
}

export function formatTmdbToolError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.startsWith('Error Reason:') ? message : `Error Reason: ${message}`
}
