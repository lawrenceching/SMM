import { rpc, unwrapJson } from '@/lib/rpc'

type RecognizeFolderDb = 'tmdb' | 'tvdb'

export interface RecognizeFolderParams {
  path: string
  db: RecognizeFolderDb
  id: string
}

type RecognizeFolderResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['recognize-folder']['$post']>>['json']>
>

/** `POST /api/recognize-folder` → `Core.recognizeFolder`. */
async function recognizeFolder(
  params: RecognizeFolderParams,
  signal?: AbortSignal,
): Promise<RecognizeFolderResponseBody> {
  const resp = await rpc.api['recognize-folder'].$post(
    { json: params },
    { init: { signal } },
  )
  return unwrapJson(resp)
}

/** Throws on business error. */
export async function recognizeFolderViaCore(params: RecognizeFolderParams): Promise<void> {
  const body = await recognizeFolder(params)
  if ('error' in body) {
    throw new Error(body.error)
  }
}
