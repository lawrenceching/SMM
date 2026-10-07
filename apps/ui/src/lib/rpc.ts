import { hc } from 'hono/client'
import type { AppType } from '@smm/server'
import { apiFetch } from '@/lib/apiFetch'

export const rpc = hc<AppType>('', { fetch: apiFetch })

export async function unwrapJson<T>(resp: Response & { json(): Promise<T> }): Promise<T> {
  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`)
  }
  return resp.json()
}
