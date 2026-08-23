export const DEFAULT_CORE_ROUTES_PORT = 3001

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
 * Resolve the core-routes HTTP listen port.
 *
 * Order: `CLI_PORT` → `CORE_ROUTES_PORT` → 3001.
 */
export function resolveCoreRoutesPort(
  env: Record<string, string | undefined> = process.env,
): number {
  return (
    parsePositivePort(env.CLI_PORT) ??
    parsePositivePort(env.CORE_ROUTES_PORT) ??
    DEFAULT_CORE_ROUTES_PORT
  )
}
