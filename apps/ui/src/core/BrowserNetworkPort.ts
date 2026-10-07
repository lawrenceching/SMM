import type { FetchInit, HttpResponse, NetworkPort } from '../../../core/src/ports/NetworkPort'
import { rpc, unwrapJson } from '@/lib/rpc'

type CoreFetchResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)['api']['core']['fetch']['$post']>>['json']>
>

type CoreFetchSuccessBody = Exclude<CoreFetchResponseBody, { error: string }>

type CoreFetchResponseData = CoreFetchSuccessBody['data']

/** Request body for `POST /api/core/fetch`. */
interface CoreFetchRequestBody {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  proxy?: string
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

/**
 * Browser NetworkPort: relays outbound HTTP through `POST /api/core/fetch`,
 * which runs {@link NodejsNetworkPort} on the CLI (proxy-capable).
 */
export class BrowserNetworkPort implements NetworkPort {
  async fetch(input: string, init?: FetchInit): Promise<HttpResponse> {
    const requestBody: CoreFetchRequestBody = {
      url: input,
    }
    if (init?.method !== undefined) requestBody.method = init.method
    if (init?.headers !== undefined) requestBody.headers = init.headers
    if (init?.body !== undefined) requestBody.body = init.body
    if (init?.proxy !== undefined) requestBody.proxy = init.proxy

    const response = await rpc.api.core.fetch.$post(
      { json: requestBody },
      { init: { signal: init?.signal } },
    )

    const body = await unwrapJson(response)

    if ('error' in body) {
      throw new Error(body.error)
    }
    return dataToHttpResponse(body.data)
  }
}
