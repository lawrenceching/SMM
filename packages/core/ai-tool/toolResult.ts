export function toolOk<T extends Record<string, unknown>>(
  data: T,
): T & { error: undefined } {
  return { ...data, error: undefined }
}

export function toolError(reason: string): { error: string } {
  const message = reason.startsWith('Error Reason:')
    ? reason
    : `Error Reason: ${reason}`
  return { error: message }
}

export function requireNonEmptyString(
  value: unknown,
  field: string,
): string | { error: string } {
  if (typeof value !== 'string' || value.trim() === '') {
    return { error: `Invalid ${field}: must be a non-empty string` }
  }
  return value
}

export function formatToolError(error: unknown): { error: string } {
  return toolError(error instanceof Error ? error.message : 'Unknown error')
}
