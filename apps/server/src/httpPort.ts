export const DEFAULT_HTTP_PORT = 30000

function parsePositivePort(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined
  }
  const trimmed = raw.trim()
  if (trimmed === '') {
    return undefined
  }
  const port = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(port) || port <= 0) {
    return undefined
  }
  return port
}

/**
 * Resolve the unified HTTP listen port (static UI + API).
 *
 * Order: `HTTP_PORT` → `PORT` → 30000.
 */
export function resolveHttpPort(
  env: Record<string, string | undefined> = process.env,
): number {
  return (
    parsePositivePort(env.HTTP_PORT) ??
    parsePositivePort(env.PORT) ??
    DEFAULT_HTTP_PORT
  )
}
