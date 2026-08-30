import type {
  SetWatchedFolderRequestBody,
  SetWatchedFolderResponseBody,
} from "@smm/types"
import { apiFetch } from "@/lib/apiFetch"

export async function setWatchedFolder(
  folderPath: string | null,
  signal?: AbortSignal,
): Promise<SetWatchedFolderResponseBody> {
  const body: SetWatchedFolderRequestBody = { folderPath }
  const resp = await apiFetch("/api/setWatchedFolder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`setWatchedFolder: HTTP ${resp.status} ${resp.statusText}`)
  }

  const data = (await resp.json()) as SetWatchedFolderResponseBody
  if (data.error) {
    console.error("[setWatchedFolder] API error", data.error)
  }
  return data
}
