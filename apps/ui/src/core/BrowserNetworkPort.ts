import type { FetchInit, HttpResponse, NetworkPort } from '../../../core/src/ports/NetworkPort'
import { apiFetch } from '@/lib/apiFetch'

/** Request body for `POST /api/core/fetch`. */
export interface CoreFetchRequestBody {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  proxy?: string
}

/** Upstream response payload inside API `data`. */
export interface CoreFetchResponseData {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  /** Raw response body, base64-encoded (binary-safe). */
  bodyBase64: string
}

export interface CoreFetchResponseBody {
  data?: CoreFetchResponseData
  error?: string
}

function decodeBodyBase64(bodyBase64: string): Uint8Array {
  const binary = atob(bodyBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function dataToHttpResponse(data: CoreFetchResponseData): HttpResponse {
  const bytes = decodeBodyBase64(data.bodyBase64)
  const textDecoder = new TextDecoder()
  let textCache: string | undefined
  let jsonCache: unknown

  return {
    ok: data.ok,
    status: data.status,
    statusText: data.statusText,
    headers: data.headers,
    async text() {
      if (textCache === undefined) {
        textCache = textDecoder.decode(bytes)
      }
      return textCache
    },
    async json<T = unknown>() {
      if (jsonCache === undefined) {
        jsonCache = JSON.parse(await this.text())
      }
      return jsonCache as T
    },
    async arrayBuffer(): Promise<ArrayBuffer> {
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer
    },
  }
}

export interface BrowserNetworkPortOptions {
  /** Override internal API fetch (defaults to {@link apiFetch}). */
  fetchImpl?: typeof fetch
  /** Path of the core fetch RPC (default `/api/core/fetch`). */
  endpoint?: string
}

/**
 * Browser NetworkPort: relays outbound HTTP through `POST /api/core/fetch`,
 * which runs {@link NodejsNetworkPort} on the CLI (proxy-capable).
 */
export class BrowserNetworkPort implements NetworkPort {
  private readonly fetchImpl: typeof fetch
  private readonly endpoint: string

  constructor(options?: BrowserNetworkPortOptions) {
    this.fetchImpl = options?.fetchImpl ?? apiFetch
    this.endpoint = options?.endpoint ?? '/api/core/fetch'
  }

  async fetch(input: string, init?: FetchInit): Promise<HttpResponse> {
    const requestBody: CoreFetchRequestBody = {
      url: input,
    }
    if (init?.method !== undefined) requestBody.method = init.method
    if (init?.headers !== undefined) requestBody.headers = init.headers
    if (init?.body !== undefined) requestBody.body = init.body
    if (init?.proxy !== undefined) requestBody.proxy = init.proxy

    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: init?.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP Layer Error: ${response.status} ${response.statusText}`)
    }

    const json = (await response.json()) as CoreFetchResponseBody
    if (json.error) {
      throw new Error(json.error)
    }
    if (!json.data) {
      throw new Error('Error Reason: /api/core/fetch returned no data')
    }
    return dataToHttpResponse(json.data)
  }
}
