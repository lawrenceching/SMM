/**
 * Minimal structured logger for the AI Assistant module.
 *
 * Mirrors the surface used by the CLI's `pino` logger
 * (`apps/cli/lib/logger`) so call sites in shared logic can stay
 * symmetric:
 *
 *   import { logger } from './logger'
 *   logger.info({ foo: 1 }, 'message')
 *   logger.error({ err: e }, 'failed')
 *
 * Output is JSON-friendly (single object → JSON.stringify) so it
 * shows up cleanly in browser DevTools and in CI log capture. In
 * production, the renderer console already pipes through to the
 * host's logging facility (Electron / ohos / dev server).
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

type LogPayload = Record<string, unknown> | undefined

const LEVEL_RANK: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

function currentLevel(): Level {
  // Allow runtime override via `localStorage` (e.g. while debugging
  // a HarmonyOS device that doesn't expose DevTools). Falls back
  // to `info` in production and `debug` in development.
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('smm.ai.logLevel')
    if (stored && stored in LEVEL_RANK) {
      return stored as Level
    }
  }
  if (import.meta.env?.DEV) return 'debug'
  return 'info'
}

function shouldLog(level: Level): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[currentLevel()]
}

function emit(level: Level, payload: LogPayload, message: string): void {
  if (!shouldLog(level)) return
  const line = payload ? { ...payload, msg: message } : { msg: message }
  // Use the appropriate console method for nicer DevTools formatting
  // while keeping the payload object intact for structured log
  // processors.
  const consoleFn = console[level] ?? console.log
  consoleFn(`[ai] ${message}`, line)
}

export const logger = {
  debug: (payload: LogPayload, msg: string) => emit('debug', payload, msg),
  info: (payload: LogPayload, msg: string) => emit('info', payload, msg),
  warn: (payload: LogPayload, msg: string) => emit('warn', payload, msg),
  error: (payload: LogPayload, msg: string) => emit('error', payload, msg),
}
