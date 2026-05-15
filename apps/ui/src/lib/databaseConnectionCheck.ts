export type DatabaseConnectionStatus =
  | "connected"
  | "disconnected"
  | "checking"
  | "checkFailed"

export function isInternalDatabaseCheckError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /Reverse proxy URL is not available/i.test(msg)
}

export function mapQueryStatus(
  isCheckEnabled: boolean,
  isPending: boolean,
  isFetching: boolean,
  isError: boolean,
  data: boolean | undefined,
): DatabaseConnectionStatus {
  if (!isCheckEnabled || isPending || isFetching) return "checking"
  if (isError) return "checkFailed"
  if (data === true) return "connected"
  if (data === false) return "disconnected"
  return "checking"
}
