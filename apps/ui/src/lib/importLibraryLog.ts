import { logger } from '@/lib/log'

export interface ImportLibraryTrace {
  traceId: string
}

/** Structured + console logs for import-library flow (grep by traceId). */
export function importLibraryLog(
  trace: ImportLibraryTrace | undefined,
  step: string,
  details?: Record<string, unknown>,
): void {
  if (!trace) return
  const message = `import-library: ${step}`
  if (details !== undefined) {
    console.log(`[${trace.traceId}] ${message}`, details)
    logger.info({ traceId: trace.traceId, step, ...details }, message)
  } else {
    console.log(`[${trace.traceId}] ${message}`)
    logger.info({ traceId: trace.traceId, step }, message)
  }
}
