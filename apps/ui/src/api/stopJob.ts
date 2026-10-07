import { rpc, unwrapJson } from '@/lib/rpc'

/** Asks Core to abort an import job (`POST /api/stop-job`). */
export async function stopJobViaCore(id: string): Promise<void> {
  const resp = await rpc.api['stop-job'].$post({ json: { id } })
  const body = await unwrapJson(resp)
  if ('error' in body) {
    throw new Error(body.error)
  }
}
