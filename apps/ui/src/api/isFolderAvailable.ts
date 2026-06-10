export type IsFolderAvailableResponseBody = {
 available: boolean
}

/**
 * Asks the CLI whether the given path is an existing, accessible directory.
 * Pass the same platform path string used elsewhere (e.g. list files,
 * metadata).
 */
export async function isFolderAvailable(
 path: string,
 signal?: AbortSignal,
): Promise<boolean> {
 const resp = await fetch('/api/isFolderAvailable', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ path }),
 signal,
 })
 if (!resp.ok) {
 throw new Error(`isFolderAvailable: HTTP ${resp.status} ${resp.statusText}`)
 }
 const data = (await resp.json()) as IsFolderAvailableResponseBody
 return data.available
}
