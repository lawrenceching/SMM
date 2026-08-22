import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserNetworkPort } from './BrowserNetworkPort'

describe('BrowserNetworkPort', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('POSTs to /api/core/fetch and maps data to HttpResponse', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/json' },
            bodyBase64: btoa(unescape(encodeURIComponent(JSON.stringify({ hello: 'world' })))),
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const port = new BrowserNetworkPort()
    const res = await port.fetch('https://example.com/api', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      proxy: 'socks5://127.0.0.1:1080',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/core/fetch')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      url: 'https://example.com/api',
      method: 'GET',
      headers: { Accept: 'application/json' },
      proxy: 'socks5://127.0.0.1:1080',
    })

    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/json')
    await expect(res.json()).resolves.toEqual({ hello: 'world' })
  })

  it('throws when API returns error field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Error Reason: Unsupported proxy scheme: "ftp:"' }), {
          status: 200,
        }),
      ),
    )

    const port = new BrowserNetworkPort()
    await expect(port.fetch('https://example.com', { proxy: 'ftp://x' })).rejects.toThrow(
      /Unsupported proxy scheme/i,
    )
  })

  it('forwards AbortSignal to the internal API fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: {},
            bodyBase64: btoa('ok'),
          },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const controller = new AbortController()
    const port = new BrowserNetworkPort()
    await port.fetch('https://example.com', { signal: controller.signal })

    expect(fetchMock.mock.calls[0]![1].signal).toBe(controller.signal)
  })
})
