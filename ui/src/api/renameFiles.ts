import type { RenameFilesRequestBody, RenameFilesResponseBody } from "@core/types"

export async function renameFiles(params: RenameFilesRequestBody): Promise<RenameFilesResponseBody> {
  const resp = await fetch("/api/renameFiles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  })

  if (!resp.ok) {
    throw new Error(`Failed to rename files: ${resp.statusText}`)
  }

  const data: RenameFilesResponseBody = await resp.json()
  if (data.error) {
    throw new Error(data.error)
  }

  return data
}
