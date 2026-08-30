import http from 'node:http'
import https from 'node:https'
import type { Agent } from 'node:http'
import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'
import type { FetchInit, HttpResponse, NetworkPort } from 'core-app'

const SUPPORTED_PROXY_PROTOCOLS = new Set(['http:', 'https:', 'socks5:', 'socks5h:'])

function isBunRuntime(): boolean {
  return typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined'
}

function assertSupportedProxy(proxyUrl: string): URL {
  let parsed: URL
  try {
    parsed = new URL(proxyUrl)
  } catch {
    throw new Error(`Unsupported proxy scheme: invalid URL "${proxyUrl}"`)
  }
  if (!SUPPORTED_PROXY_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(
      `Unsupported proxy scheme: "${parsed.protocol}". Use http://, https://, or socks5://.`,
    )
  }
  return parsed
}

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    out[key] = value
  })
  return out
}

function toHttpResponse(response: Response): HttpResponse {
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: headersToRecord(response.headers),
    text: () => response.text(),
    json: <T = unknown>() => response.json() as Promise<T>,
    arrayBuffer: () => response.arrayBuffer(),
  }
}

function stripProxyFromInit(init?: FetchInit): RequestInit {
  if (!init) return {}
  const { proxy: _proxy, ...rest } = init
  return rest
}

function buildAgentRequestHeaders(init: FetchInit | undefined, target: URL): Record<string, string> {
  const headers: Record<string, string> = { ...(init?.headers ?? {}) }
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'accept-encoding') {
      delete headers[key]
    }
  }
  headers.Host = target.host
  return headers
}

function abortError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) return signal.reason
  const err = new Error('This operation was aborted')
  err.name = 'AbortError'
  return err
}

function requestViaAgent(
  input: string,
  init: FetchInit | undefined,
  agent: Agent,
  timeoutMessage: string,
): Promise<Response> {
  const url = new URL(input)
  const method = (init?.method ?? 'GET').toUpperCase()
  const isBodyAllowed = method !== 'GET' && method !== 'HEAD'
  const isHttps = url.protocol === 'https:'
  const headers = buildAgentRequestHeaders(init, url)
  const signal = init?.signal

  return new Promise<Response>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal))
      return
    }

    let settled = false
    const settleReject = (err: Error) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      reject(err)
    }
    const settleResolve = (res: Response) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      resolve(res)
    }

    const requestOptions: http.RequestOptions = {
      hostname: url.hostname,
      port: Number(url.port) || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers,
      agent,
      timeout: 30_000,
    }

    const req = (isHttps ? https : http).request(requestOptions, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const body = Buffer.concat(chunks)
        const headerInit: Record<string, string> = {}
        for (const [key, value] of Object.entries(res.headers)) {
          if (value === undefined) continue
          headerInit[key] = Array.isArray(value) ? value.join(', ') : value
        }
        settleResolve(
          new Response(body, {
            status: res.statusCode ?? 502,
            statusText: res.statusMessage ?? '',
            headers: headerInit,
          }),
        )
      })
      res.on('error', (err) => {
        if (signal?.aborted) settleReject(abortError(signal))
        else settleReject(err instanceof Error ? err : new Error(String(err)))
      })
    })

    const onAbort = () => {
      req.destroy()
      settleReject(abortError(signal))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    // Cover abort between the initial aborted check and listener registration.
    if (signal?.aborted) {
      onAbort()
      return
    }

    req.on('error', (err) => {
      if (signal?.aborted) {
        settleReject(abortError(signal))
        return
      }
      settleReject(err instanceof Error ? err : new Error(String(err)))
    })
    req.on('timeout', () => {
      req.destroy()
      settleReject(new Error(timeoutMessage))
    })

    if (isBodyAllowed && init?.body !== undefined) {
      req.write(init.body)
    }
    req.end()
  })
}

function agentForProxy(proxyUrl: string, targetUrl: string): Agent {
  const target = new URL(targetUrl)
  const proxy = new URL(proxyUrl)

  // Cast: agent packages type `http` vs `node:http` Agent incompatibly under strict TS.
  if (proxy.protocol === 'socks5:' || proxy.protocol === 'socks5h:') {
    // Clash/V2Ray and similar SOCKS ports reset TLS when Node resolves DNS locally
    // (`socks5://`). `socks5h://` lets the proxy resolve the hostname (same as curl --socks5-hostname).
    const socks = new URL(proxyUrl)
    if (socks.protocol === 'socks5:') socks.protocol = 'socks5h:'
    return new SocksProxyAgent(socks.toString()) as unknown as Agent
  }

  // https:// target → CONNECT tunnel; http:// target → absolute-URL forward.
  // HttpsProxyAgent / HttpProxyAgent also speak to https:// proxy endpoints.
  if (target.protocol === 'https:') {
    return new HttpsProxyAgent(proxyUrl) as unknown as Agent
  }
  return new HttpProxyAgent(proxyUrl) as unknown as Agent
}

async function fetchViaNodeProxy(
  input: string,
  init: FetchInit | undefined,
  proxyUrl: string,
): Promise<HttpResponse> {
  const agent = agentForProxy(proxyUrl, input)
  const proxy = new URL(proxyUrl)
  const timeoutMessage =
    proxy.protocol === 'socks5:' || proxy.protocol === 'socks5h:'
      ? 'SOCKS5 proxy request timeout'
      : new URL(input).protocol === 'https:'
        ? 'HTTPS proxy request timeout'
        : 'HTTP proxy request timeout'
  const response = await requestViaAgent(input, init, agent, timeoutMessage)
  return toHttpResponse(response)
}

async function fetchViaBun(
  input: string,
  init: FetchInit | undefined,
  proxyUrl: string,
): Promise<HttpResponse> {
  const response = await fetch(input, {
    ...stripProxyFromInit(init),
    proxy: proxyUrl,
  } as RequestInit & { proxy: string })
  return toHttpResponse(response)
}

/**
 * Node/Bun NetworkPort with optional outbound proxy (`http://`, `https://`, `socks5://`).
 * Independent of `@smm/core-routes` `createProxiedFetch`.
 */
export class NodejsNetworkPort implements NetworkPort {
  async fetch(input: string, init?: FetchInit): Promise<HttpResponse> {
    const proxy = init?.proxy?.trim()
    if (!proxy) {
      const response = await fetch(input, stripProxyFromInit(init))
      return toHttpResponse(response)
    }

    assertSupportedProxy(proxy)

    if (isBunRuntime()) {
      return fetchViaBun(input, init, proxy)
    }

    return fetchViaNodeProxy(input, init, proxy)
  }
}
