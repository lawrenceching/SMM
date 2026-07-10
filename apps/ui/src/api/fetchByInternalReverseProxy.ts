import { isEmpty } from "es-toolkit/compat"
import { hello } from "./hello"

let cachedReverseProxyUrl: string | null = null

async function getReverseProxyUrl(): Promise<string> {
    if (cachedReverseProxyUrl) return cachedReverseProxyUrl
    const { reverseProxyUrl } = await hello()
    if (!reverseProxyUrl) {
        throw new Error(
            'Reverse proxy URL is not available. Ensure the CLI started successfully and the hello task has completed.',
        )
    }
    cachedReverseProxyUrl = reverseProxyUrl
    return cachedReverseProxyUrl
}

/**
 * Test-only helper to clear the memoized reverse-proxy URL between cases.
 */
export function _resetInternalReverseProxyCacheForTesting(): void {
    cachedReverseProxyUrl = null
}

/**
 * Route a request through the local SMM reverse proxy.
 *
 * Contract (matches `buildUpstreamUrl` in core-routes):
 * - Request URL path is the API path only (e.g. `/search/tv?query=…`)
 * - `X-SMM-Proxy-Upstream-BaseURL` is the full upstream base including any
 *   path prefix (e.g. `https://api.themoviedb.org/3`)
 */
export async function fetchByInternalReverseProxy(
    upstreamBaseURL: string,
    urlPath: string,
    init?: RequestInit & { httpProxy?: string },
): Promise<Response> {
    const reverseProxyUrl = await getReverseProxyUrl()
    const proxyBase = reverseProxyUrl.replace(/\/+$/, '')
    const normalizedPath = urlPath.startsWith('/') ? urlPath : `/${urlPath}`
    const proxyUrl = `${proxyBase}${normalizedPath}`

    const upstream = upstreamBaseURL.replace(/\/+$/, '')
    const { httpProxy, headers: initHeaders, ...restInit } = init ?? {}
    const headers: Record<string, string> = {}
    if (initHeaders) {
        new Headers(initHeaders).forEach((value, key) => {
            // Preserve common auth header casing expected by callers/tests.
            if (key.toLowerCase() === 'authorization') {
                headers.Authorization = value
            } else {
                headers[key] = value
            }
        })
    }
    headers['X-SMM-Proxy-Upstream-BaseURL'] = upstream

    if (!isEmpty(httpProxy)) {
        headers['X-Http-Proxy'] = httpProxy!.trim()
    }

    return fetch(proxyUrl, {
        method: 'GET',
        cache: 'no-store',
        ...restInit,
        headers,
    })
}
