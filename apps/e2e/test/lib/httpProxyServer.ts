import { URL } from 'node:url'
import { Server } from 'proxy-chain'

let server: Server | null = null
let proxyAddress: string | null = null

export const DEFAULT_EMBEDDED_PROXY_ADDRESS = 'http://127.0.0.1:8990'

/**
 * Whether to start the in-process proxy-chain server for HTTP-proxy specs.
 *
 * HarmonyOS: the app runs on device. An embedded proxy on the host's
 * `127.0.0.1` is unreachable from the device, so always use
 * `TMDB_HTTP_PROXY` / `TVDB_HTTP_PROXY` from `apps/e2e/.env.local` instead.
 */
export function useEmbeddedHttpProxy(): boolean {
    if (process.env.E2E_PLATFORM === 'ohos') {
        return false
    }
    return process.env.USE_EMBEDDED_HTTP_PROXY !== 'false'
}

export function getCurrentProxyAddress(): string | null {
    return proxyAddress
}

/**
 * HTTP proxy URL to write into userConfig for e2e.
 * Prefer a running embedded proxy; otherwise TMDB_/TVDB_HTTP_PROXY from env.
 */
export function getConfiguredHttpProxyAddress(kind: 'tmdb' | 'tvdb' = 'tmdb'): string {
    const fromEmbedded = getCurrentProxyAddress()
    if (fromEmbedded) {
        return fromEmbedded
    }
    const envKey = kind === 'tmdb' ? 'TMDB_HTTP_PROXY' : 'TVDB_HTTP_PROXY'
    return (process.env[envKey] || '').trim()
}

export async function startEmbeddedHttpProxy(address: string): Promise<void> {
    if (server) {
        return
    }

    if (process.env.TMDB_HTTP_PROXY) {
        console.log(`[Embedded HTTP Proxy] USE_EMBEDDED_HTTP_PROXY=true, ignoring TMDB_HTTP_PROXY=${process.env.TMDB_HTTP_PROXY}`)
    }
    if (process.env.TVDB_HTTP_PROXY) {
        console.log(`[Embedded HTTP Proxy] USE_EMBEDDED_HTTP_PROXY=true, ignoring TVDB_HTTP_PROXY=${process.env.TVDB_HTTP_PROXY}`)
    }

    const url = new URL(address)
    const port = parseInt(url.port, 10)
    const host = url.hostname

    server = new Server({
        port,
        host,
        verbose: false,
    })

    await server.listen()
    proxyAddress = address
    console.log(`[Embedded HTTP Proxy] Started on ${address}`)
}

export async function stopEmbeddedHttpProxy(): Promise<void> {
    if (server) {
        await server.close(true)
        server = null
        proxyAddress = null
        console.log('[Embedded HTTP Proxy] Stopped')
    }
}
