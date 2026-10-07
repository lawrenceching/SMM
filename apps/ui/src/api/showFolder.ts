import { rpc, unwrapJson } from '@/lib/rpc'

type ShowFolderResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['show-folder']['$post']>>['json']>
>

type ShowFolderResult = Exclude<ShowFolderResponseBody, { error: string }>['data']

/** Resolve folder display status via Core (`POST /api/show-folder`). */
async function showFolder(path: string, signal?: AbortSignal): Promise<ShowFolderResponseBody> {
  const resp = await rpc.api['show-folder'].$post(
    { json: { path } },
    { init: { signal } },
  )
  return unwrapJson(resp)
}

/** Throws on business error; returns show-folder payload. */
export async function showFolderViaCore(path: string, signal?: AbortSignal): Promise<ShowFolderResult> {
  const body = await showFolder(path, signal)
  if ('error' in body) {
    throw new Error(body.error)
  }
  return body.data
}
