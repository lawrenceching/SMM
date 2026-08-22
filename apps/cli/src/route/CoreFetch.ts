import type { Hono } from 'hono'
import { NodejsNetworkPort } from '../core/NodejsNetworkPort'
import { logger } from '../../lib/logger'

export interface CoreFetchRequestBody {
  url?: unknown
  method?: unknown
  headers?: unknown
  body?: unknown
  proxy?: unknown
}

export interface CoreFetchResponseData {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  bodyBase64: string
}

export interface CoreFetchResponseBody {
  data?: CoreFetchResponseData
  error?: string
}

function isPlainStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.values(value).every((v) => typeof v === 'string')
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = (error as { name?: string }).name
  return name === 'AbortError'
}

/**
 * `POST /api/core/fetch` — browser NetworkPort relay.
 * Performs the outbound request with {@link NodejsNetworkPort} (direct or via proxy).
 *
 * Client disconnect / `AbortSignal` on the incoming request is forwarded to
 * the network port via `c.req.raw.signal` (same pattern as executeCmd).
 */
export function handleCoreFetch(
  app: Hono,
  options?: { network?: import('core-app').NetworkPort },
): void {
  const network = options?.network ?? new NodejsNetworkPort()

  app.post('/api/core/fetch', async (c) => {
    try {
      let body: CoreFetchRequestBody = {}
      try {
        body = (await c.req.json()) as CoreFetchRequestBody
      } catch {
        /* empty / invalid JSON — may also abort while reading body */
        if (c.req.raw.signal.aborted) throw abortFromSignal(c.req.raw.signal)
      }

      if (typeof body.url !== 'string' || body.url.trim() === '') {
        const err: CoreFetchResponseBody = { error: 'Error Reason: url is required' }
        return c.json(err, 200)
      }

      const method = typeof body.method === 'string' ? body.method : undefined
      const headers = isPlainStringRecord(body.headers) ? body.headers : undefined
      const requestBody = typeof body.body === 'string' ? body.body : undefined
      const proxy = typeof body.proxy === 'string' ? body.proxy : undefined

      // Penetrate browser AbortSignal → NodejsNetworkPort (and upstream).
      const signal = c.req.raw.signal

      const upstream = await network.fetch(body.url, {
        method,
        headers,
        body: requestBody,
        proxy,
        signal,
      })

      const bytes = new Uint8Array(await upstream.arrayBuffer())
      const data: CoreFetchResponseData = {
        ok: upstream.ok,
        status: upstream.status,
        statusText: upstream.statusText,
        headers: upstream.headers,
        bodyBase64: Buffer.from(bytes).toString('base64'),
      }
      const ok: CoreFetchResponseBody = { data }
      return c.json(ok, 200)
    } catch (error) {
      // Do not convert abort into a business `{ error }` JSON — let the
      // connection drop / fetch reject like a cancelled request.
      if (isAbortError(error) || c.req.raw.signal.aborted) {
        throw error
      }
      logger.error({ error }, '[POST /api/core/fetch] route error')
      const err: CoreFetchResponseBody = {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      return c.json(err, 200)
    }
  })
}

function abortFromSignal(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason
  const err = new Error('This operation was aborted')
  err.name = 'AbortError'
  return err
}
