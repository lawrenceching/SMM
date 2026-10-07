import { hc } from 'hono/client'
import type { AppType } from '@smm/server'
import { apiFetch } from '@/lib/apiFetch'

export const rpc = hc<AppType>('', { fetch: apiFetch })
