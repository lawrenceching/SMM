import {
  createServer as createHttpServer,
  request as httpRequest,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from 'node:http'
import { createServer as createHttpsServer, type Server as HttpsServer } from 'node:https'
import {
  createServer as createNetServer,
  connect as netConnect,
  type Server as NetServer,
  type Socket,
} from 'node:net'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Server as ProxyChainServer } from 'proxy-chain'
import { NodejsNetworkPort } from './NodejsNetworkPort'

const FIXTURES = resolve(import.meta.dirname, '__fixtures__')
const PROXY_KEY = readFileSync(resolve(FIXTURES, 'proxy-key.pem'))
const PROXY_CERT = readFileSync(resolve(FIXTURES, 'proxy-cert.pem'))

function listen(server: HttpServer | HttpsServer | NetServer): Promise<number> {
  return new Promise((resolveListen, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') resolveListen(addr.port)
      else reject(new Error('failed to bind'))
    })
  })
}

function closeServer(server: { close: (cb?: (err?: Error) => void) => void }): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close((err) => (err ? reject(err) : resolveClose()))
  })
}

/** Plain HTTP upstream that returns fixed JSON. */
async function startUpstream(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createHttpServer((req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, path: req.url ?? '/' }))
  })
  const port = await listen(server)
  return {
    url: `http://127.0.0.1:${port}/hello`,
    close: () => closeServer(server),
  }
}

/** HTTP proxy via proxy-chain (same family as e2e embedded proxy). */
async function startHttpProxy(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = new ProxyChainServer({ port: 0, host: '127.0.0.1', verbose: false })
  await server.listen()
  return {
    url: `http://127.0.0.1:${server.port}`,
    close: async () => {
      await server.close(true)
    },
  }
}

/**
 * Minimal TLS-terminated HTTP proxy (`https://` proxy URL).
 * Handles absolute-form requests for `http://` upstreams.
 */
async function startHttpsProxy(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createHttpsServer({ key: PROXY_KEY, cert: PROXY_CERT }, (req, res) => {
    const target = req.url
    if (!target || !/^https?:\/\//i.test(target)) {
      res.writeHead(400)
      res.end('absolute-form URL required')
      return
    }
    const upstream = new URL(target)
    const uReq = httpRequest(
      {
        hostname: upstream.hostname,
        port: Number(upstream.port) || (upstream.protocol === 'https:' ? 443 : 80),
        path: upstream.pathname + upstream.search,
        method: req.method,
        headers: { ...req.headers, host: upstream.host },
      },
      (uRes) => {
        res.writeHead(uRes.statusCode ?? 502, uRes.headers)
        uRes.pipe(res)
      },
    )
    uReq.on('error', (err) => {
      res.writeHead(502)
      res.end(String(err))
    })
    req.pipe(uReq)
  })

  server.on('connect', (req, clientSocket, head) => {
    const [host, portStr] = (req.url ?? '').split(':')
    const port = Number(portStr) || 443
    const upstream = netConnect(port, host!, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      if (head.length) upstream.write(head)
      upstream.pipe(clientSocket)
      clientSocket.pipe(upstream)
    })
    upstream.on('error', () => clientSocket.destroy())
    clientSocket.on('error', () => upstream.destroy())
  })

  const port = await listen(server)
  return {
    url: `https://127.0.0.1:${port}`,
    close: () => closeServer(server),
  }
}

/** Minimal no-auth SOCKS5 CONNECT proxy. */
async function startSocks5Proxy(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createNetServer((client: Socket) => {
    const fail = () => {
      try {
        client.destroy()
      } catch {
        /* ignore */
      }
    }

    client.once('data', (greeting: Buffer) => {
      if (greeting[0] !== 0x05) {
        fail()
        return
      }
      client.write(Buffer.from([0x05, 0x00]))

      client.once('data', (req: Buffer) => {
        if (req[0] !== 0x05 || req[1] !== 0x01) {
          client.write(Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
          fail()
          return
        }
        const atyp = req[3]
        let offset = 4
        let host: string
        if (atyp === 0x01) {
          host = `${req[4]}.${req[5]}.${req[6]}.${req[7]}`
          offset = 8
        } else if (atyp === 0x03) {
          const len = req[4]!
          host = req.subarray(5, 5 + len).toString('utf8')
          offset = 5 + len
        } else {
          client.write(Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
          fail()
          return
        }
        const port = (req[offset]! << 8) | req[offset + 1]!

        const upstream = netConnect(port, host, () => {
          client.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
          upstream.pipe(client)
          client.pipe(upstream)
        })
        upstream.on('error', fail)
        client.on('error', () => upstream.destroy())
      })
    })
  })

  const port = await listen(server)
  return {
    url: `socks5://127.0.0.1:${port}`,
    close: () => closeServer(server),
  }
}

describe('NodejsNetworkPort', () => {
  const network = new NodejsNetworkPort()
  let upstream: { url: string; close: () => Promise<void> }

  beforeAll(async () => {
    upstream = await startUpstream()
  })

  afterAll(async () => {
    await upstream.close()
  })

  it('fetches without proxy (direct)', async () => {
    const res = await network.fetch(upstream.url)
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true, path: '/hello' })
  })

  it('fetches via http:// proxy', async () => {
    const proxy = await startHttpProxy()
    try {
      const res = await network.fetch(upstream.url, { proxy: proxy.url })
      expect(res.ok).toBe(true)
      await expect(res.json()).resolves.toEqual({ ok: true, path: '/hello' })
    } finally {
      await proxy.close()
    }
  })

  it('fetches via https:// proxy', async () => {
    const proxy = await startHttpsProxy()
    const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    try {
      const res = await network.fetch(upstream.url, { proxy: proxy.url })
      expect(res.ok).toBe(true)
      await expect(res.json()).resolves.toEqual({ ok: true, path: '/hello' })
    } finally {
      if (prev === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
      else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev
      await proxy.close()
    }
  })

  it('fetches via socks5:// proxy', async () => {
    const proxy = await startSocks5Proxy()
    try {
      const res = await network.fetch(upstream.url, { proxy: proxy.url })
      expect(res.ok).toBe(true)
      await expect(res.json()).resolves.toEqual({ ok: true, path: '/hello' })
    } finally {
      await proxy.close()
    }
  })

  it('rejects unsupported proxy scheme', async () => {
    await expect(network.fetch(upstream.url, { proxy: 'ftp://127.0.0.1:1' })).rejects.toThrow(
      /unsupported proxy scheme/i,
    )
  })

  it('rejects when proxy is unreachable', async () => {
    await expect(network.fetch(upstream.url, { proxy: 'http://127.0.0.1:1' })).rejects.toThrow()
  })

  it('aborts an in-flight direct fetch when AbortSignal fires', async () => {
    let upstreamHit = 0
    const slow = createHttpServer((_req, res) => {
      upstreamHit += 1
      // Hang until client aborts / connection closes
      _req.on('close', () => {
        try {
          res.destroy()
        } catch {
          /* ignore */
        }
      })
    })
    const port = await listen(slow)
    const url = `http://127.0.0.1:${port}/slow`
    const controller = new AbortController()
    const pending = network.fetch(url, { signal: controller.signal })
    await new Promise((r) => setTimeout(r, 30))
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await closeServer(slow)
    expect(upstreamHit).toBeGreaterThanOrEqual(0)
  })

  it('rejects http-proxy fetch when AbortSignal is already aborted', async () => {
    const proxy = await startHttpProxy()
    try {
      const controller = new AbortController()
      controller.abort()
      await expect(
        network.fetch(upstream.url, { proxy: proxy.url, signal: controller.signal }),
      ).rejects.toMatchObject({ name: 'AbortError' })
    } finally {
      await proxy.close()
    }
  })
})
