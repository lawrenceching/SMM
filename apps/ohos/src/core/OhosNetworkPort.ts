import type { FetchInit, HttpResponse, NetworkPort } from "../../../core/src/ports/NetworkPort"
import { loadCoreRoutes } from "../core-routes-loader"

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface OhosNetworkPortOptions {
  /** Direct (no-proxy) fetch. Defaults to `createNodeHttpFetch()` from core-routes.js. */
  createNodeHttpFetch?: () => FetchLike
  /**
   * Factory for proxied fetch. Defaults to `createProxiedFetch` from core-routes.js
   * (HTTP(S) + SOCKS5 agents bundled there for OHOS).
   */
  createProxiedFetch?: (proxyUrl: string) => FetchLike | undefined
}

const SUPPORTED_PROXY_PROTOCOLS = new Set(["http:", "https:", "socks5:", "socks5h:"])

function assertSupportedProxy(proxyUrl: string): void {
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

function defaultCreateNodeHttpFetch(): FetchLike {
  return loadCoreRoutes().createNodeHttpFetch() as FetchLike
}

function defaultCreateProxiedFetch(proxyUrl: string): FetchLike | undefined {
  const createProxiedFetch = loadCoreRoutes().createProxiedFetch
  if (!createProxiedFetch) {
    throw new Error(
      "createProxiedFetch is not available in core-routes.js; rebuild the OHOS core-routes bundle",
    )
  }
  return createProxiedFetch(proxyUrl) as FetchLike | undefined
}

/**
 * HarmonyOS Electron NetworkPort.
 *
 * Direct traffic uses `createNodeHttpFetch` (undici/WASM is broken on OHOS).
 * Proxied traffic uses `createProxiedFetch` from the external `core-routes.js`
 * bundle (same agent stack as reverse proxy).
 */
export class OhosNetworkPort implements NetworkPort {
  private readonly createNodeHttpFetch: () => FetchLike
  private readonly createProxiedFetch: (proxyUrl: string) => FetchLike | undefined

  constructor(options?: OhosNetworkPortOptions) {
    this.createNodeHttpFetch = options?.createNodeHttpFetch ?? defaultCreateNodeHttpFetch
    this.createProxiedFetch = options?.createProxiedFetch ?? defaultCreateProxiedFetch
  }

  async fetch(input: string, init?: FetchInit): Promise<HttpResponse> {
    const proxy = init?.proxy?.trim()
    const requestInit = stripProxyFromInit(init)

    if (!proxy) {
      const response = await this.createNodeHttpFetch()(input, requestInit)
      return toHttpResponse(response)
    }

    assertSupportedProxy(proxy)
    const proxiedFetch = this.createProxiedFetch(proxy)
    if (!proxiedFetch) {
      throw new Error(`Failed to create proxied fetch for "${proxy}"`)
    }
    const response = await proxiedFetch(input, requestInit)
    return toHttpResponse(response)
  }
}
