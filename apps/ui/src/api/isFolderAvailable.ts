import { apiFetch } from '@/lib/apiFetch';
export type IsFolderAvailableResponseBody = {
  available: boolean
  reason?: string
}

/**
 * Asks the CLI whether the given path is an existing, accessible directory.
 */
export async function postIsFolderAvailable(
  path: string,
  signal?: AbortSignal,
): Promise<IsFolderAvailableResponseBody> {
  const resp = await apiFetch('/api/isFolderAvailable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
    signal,
  })
  if (!resp.ok) {
    throw new Error(`isFolderAvailable: HTTP ${resp.status} ${resp.statusText}`)
  }
  return (await resp.json()) as IsFolderAvailableResponseBody
}

/** Convenience wrapper — returns only the boolean (UI initializer, hooks). */
export async function isFolderAvailable(
  path: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const data = await postIsFolderAvailable(path, signal)
  return data.available
}
