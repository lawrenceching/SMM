import { URL } from 'node:url'
import { Server } from 'proxy-chain'

let server: Server | null = null
let proxyAddress: string | null = null

export const DEFAULT_EMBEDDED_PROXY_ADDRESS = 'http://127.0.0.1:8990'

export function useEmbeddedHttpProxy(): boolean {
    return process.env.USE_EMBEDDED_HTTP_PROXY !== 'false'
}

export function getCurrentProxyAddress(): string | null {
    return proxyAddress
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
