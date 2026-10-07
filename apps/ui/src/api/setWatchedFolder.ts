import { rpc, unwrapJson } from "@/lib/rpc"

type SetWatchedFolderResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['setWatchedFolder']['$post']>>['json']>
>

export async function setWatchedFolder(
  folderPath: string | null,
  signal?: AbortSignal,
): Promise<SetWatchedFolderResponseBody> {
  const resp = await rpc.api.setWatchedFolder.$post(
    { json: { folderPath } },
    { init: { signal } },
  )

  const data = await unwrapJson(resp)
  if (data.error) {
    console.error("[setWatchedFolder] API error", data.error)
  }
  return data
}
