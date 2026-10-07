import { rpc } from '@/lib/rpc'

export async function getFolders(signal?: AbortSignal): Promise<string[]> {
  const resp = await rpc.api['get-folders'].$post({}, { init: { signal } })
  const body = await resp.json()
  if ('error' in body) throw new Error(body.error)
  return body.data.folders
}
