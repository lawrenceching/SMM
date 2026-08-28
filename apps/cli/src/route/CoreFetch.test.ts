import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { Hono } from 'hono'
import { handleCoreFetch } from './CoreFetch'

describe('POST /api/core/fetch', () => {
  let app: Hono
  let upstream: Server
  let upstreamUrl: string

  beforeAll(async () => {
    app = new Hono()
    handleCoreFetch(app)

    upstream = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true, via: 'upstream' }))
    })
    await new Promise<void>((resolve) => {
      upstream.listen(0, '127.0.0.1', () => resolve())
    })
    const addr = upstream.address()
    if (!addr || typeof addr === 'string') throw new Error('no port')
    upstreamUrl = `http://127.0.0.1:${addr.port}/hello`
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      upstream.close((err) => (err ? reject(err) : resolve()))
    })
  })

  async function postCoreFetch(body: unknown) {
    return app.request('/api/core/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns Error Reason when url is missing', async () => {
    const res = await postCoreFetch({})
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/^Error Reason: url is required/)
  })

  it('fetches upstream via NodejsNetworkPort and returns bodyBase64', async () => {
    const res = await postCoreFetch({ url: upstreamUrl, method: 'GET' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      data?: {
        ok: boolean
        status: number
        headers: Record<string, string>
        bodyBase64: string
      }
      error?: string
    }
    expect(json.error).toBeUndefined()
    expect(json.data?.ok).toBe(true)
    expect(json.data?.status).toBe(200)
    const body = Buffer.from(json.data!.bodyBase64, 'base64').toString('utf8')
    expect(JSON.parse(body)).toEqual({ ok: true, via: 'upstream' })
  })

  it('returns Error Reason for unsupported proxy scheme', async () => {
    const res = await postCoreFetch({ url: upstreamUrl, proxy: 'ftp://127.0.0.1:1' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { error?: string; data?: unknown }
    expect(json.data).toBeUndefined()
    expect(json.error).toMatch(/Unsupported proxy scheme/i)
  })

  it('forwards client AbortSignal to NodejsNetworkPort', async () => {
    let seenSignal: AbortSignal | undefined
    const network = {
      async fetch(_url: string, init?: { signal?: AbortSignal }) {
        seenSignal = init?.signal
        await new Promise<never>((_resolve, reject) => {
          const signal = init?.signal
          if (!signal) {
            reject(new Error('expected signal'))
            return
          }
          if (signal.aborted) {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
            return
          }
          signal.addEventListener(
            'abort',
            () => {
              const err = new Error('aborted')
              err.name = 'AbortError'
              reject(err)
            },
            { once: true },
          )
        })
        throw new Error('unreachable')
      },
    }

    const abortApp = new Hono()
    handleCoreFetch(abortApp, { network })

    const controller = new AbortController()
    const pending = abortApp.request('/api/core/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://127.0.0.1:9/hang' }),
      signal: controller.signal,
    })

    await new Promise((r) => setTimeout(r, 20))
    expect(seenSignal).toBeDefined()
    controller.abort()

    // Hono may surface abort as a rejected fetch or an error Response.
    const result = await Promise.resolve(pending).then(
      (res) => ({ type: 'response' as const, res }),
      (err: unknown) => ({ type: 'reject' as const, err }),
    )
    expect(seenSignal?.aborted).toBe(true)
    if (result.type === 'reject') {
      expect(result.err).toBeTruthy()
    } else {
      expect(result.res.ok).toBe(false)
    }
  })
})
