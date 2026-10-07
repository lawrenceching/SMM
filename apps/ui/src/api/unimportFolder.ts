import { rpc, unwrapJson } from '@/lib/rpc'

type UnimportFolderResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['unimport-folder']['$post']>>['json']>
>

export async function unimportFolder(
  path: string,
  signal?: AbortSignal,
): Promise<UnimportFolderResponseBody> {
  const resp = await rpc.api['unimport-folder'].$post(
    { json: { path } },
    { init: { signal } },
  )
  return unwrapJson(resp)
}
