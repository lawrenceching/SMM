import type { RenameFilesInMediaMetadataRequestBody, RenameFilesInMediaMetadataResponseBody } from "@core/types"

/**
 * @deprecated Use renameFiles() with the `mediaFolder` field instead.
 * The /api/renameFiles endpoint now automatically updates media metadata and
 * broadcasts the change when `mediaFolder` is provided.
 */
export async function renameFilesInMediaMetadata(params: RenameFilesInMediaMetadataRequestBody): Promise<RenameFilesInMediaMetadataResponseBody> {
  const resp = await fetch("/api/renameFilesInMediaMetadata", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  })

  if (!resp.ok) {
    throw new Error(`Failed to rename files in media metadata: ${resp.statusText}`)
  }

  const data: RenameFilesInMediaMetadataResponseBody = await resp.json()
  if (data.error) {
    throw new Error(data.error)
  }

  return data
}
