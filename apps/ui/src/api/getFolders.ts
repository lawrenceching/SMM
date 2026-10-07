import { rpc, unwrapJson } from '@/lib/rpc'

export async function getFolders(signal?: AbortSignal): Promise<string[]> {
  const resp = await rpc.api['get-folders'].$post({}, { init: { signal } })
  const body = await unwrapJson(resp)
  if ('error' in body) throw new Error(body.error)
  return body.data.folders
}
