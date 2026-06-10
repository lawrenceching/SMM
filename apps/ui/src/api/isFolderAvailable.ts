export type IsFolderAvailableResponseBody = {
 available: boolean
}

/**
 * Asks the CLI whether the given path is an existing, accessible directory.
 *
 * The route lives on the core-routes Node `http` server (cli port30001,
 * ohos port18081), not on the Hono Bun server that hosts the UI. The
 * caller supplies the port from `HelloResponseBody.coreRoutesPort`.
 * Pass the same platform path string used elsewhere (e.g. list files,
 * metadata).
 */
export async function isFolderAvailable(
 path: string,
 coreRoutesPort: number,
 signal?: AbortSignal,
): Promise<boolean> {
 const resp = await fetch(`http://localhost:${coreRoutesPort}/api/isFolderAvailable`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ path }),
 signal,
 })
 if (!resp.ok) {
 throw new Error(`isFolderAvailable: HTTP ${resp.status} ${resp.statusText}`)
 }
 const data = (await resp.json()) as IsFolderAvailableResponseBody
 return data.available
}
