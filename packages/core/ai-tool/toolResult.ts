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

function messageFromUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error === null || error === undefined) {
    return 'Unknown error (null/undefined thrown)'
  }
  try {
    const json = JSON.stringify(error)
    if (json && json !== '{}') {
      return json
    }
  } catch {
    // fall through
  }
  const text = String(error)
  return text || 'Unknown error'
}

export function formatToolError(error: unknown): { error: string } {
  return toolError(messageFromUnknownError(error))
}
