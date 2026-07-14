import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hello } from './hello'
import { logger } from '@/lib/log'

vi.mock('./hello', () => ({
  hello: vi.fn(),
}))

vi.mock('@/lib/log', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const mockLogger = vi.mocked(logger)

const mockHello = vi.mocked(hello)

const REVERSE_PROXY_URL = 'http://127.0.0.1:30005'

function okResponse(body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, statusText: 'OK' })
}

function headersOf(init: RequestInit | undefined): Record<string, string> {
  const h = init?.headers
  if (!h) return {}
  if (h instanceof Headers) {
    const out: Record<string, string> = {}
    h.forEach((v, k) => {
      out[k.toLowerCase()] = v
    })
    return out
  }
  if (Array.isArray(h)) {
    return Object.fromEntries(h.map(([k, v]) => [k.toLowerCase(), v]))
  }
  return Object.fromEntries(
    Object.entries(h).map(([k, v]) => [k.toLowerCase(), String(v)]),
  )
}

async function loadSubject() {
  return import('./fetchByInternalReverseProxy')
}

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()))
  mockHello.mockResolvedValue({
    reverseProxyUrl: REVERSE_PROXY_URL,
    userDataDir: '/tmp/smm',
  } as Awaited<ReturnType<typeof hello>>)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('fetchByInternalReverseProxy', () => {
  it('rewrites the request through the reverse proxy URL from hello()', async () => {
    const { fetchByInternalReverseProxy } = await loadSubject()
    const fetchMock = vi.mocked(fetch)

    await fetchByInternalReverseProxy(
      'https://api.themoviedb.org/3',
      '/search/movie?query=matrix',
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]![0]).toBe(
      `${REVERSE_PROXY_URL}/search/movie?query=matrix`,
    )
  })

  it('sets X-SMM-Proxy-Upstream-BaseURL to the full upstream base (including path)', async () => {
    const { fetchByInternalReverseProxy } = await loadSubject()
    const fetchMock = vi.mocked(fetch)

    await fetchByInternalReverseProxy('https://api.themoviedb.org/3/', '/movie/550')

    const headers = headersOf(fetchMock.mock.calls[0]![1])
    expect(headers['x-smm-proxy-upstream-baseurl']).toBe('https://api.themoviedb.org/3')
  })

  it('strips trailing slashes from the reverse proxy base URL', async () => {
    mockHello.mockResolvedValue({
      reverseProxyUrl: 'http://127.0.0.1:30005///',
      userDataDir: '/tmp/smm',
    } as Awaited<ReturnType<typeof hello>>)
    const { fetchByInternalReverseProxy } = await loadSubject()
    const fetchMock = vi.mocked(fetch)

    await fetchByInternalReverseProxy('https://api4.thetvdb.com/v4', '/search?query=lost')

    expect(fetchMock.mock.calls[0]![0]).toBe(
      'http://127.0.0.1:30005/search?query=lost',
    )
  })

  it('normalizes urlPath without a leading slash', async () => {
    const { fetchByInternalReverseProxy } = await loadSubject()
    const fetchMock = vi.mocked(fetch)

    await fetchByInternalReverseProxy('https://api.themoviedb.org/3', 'movie/1')

    expect(fetchMock.mock.calls[0]![0]).toBe(`${REVERSE_PROXY_URL}/movie/1`)
  })

  it('sets X-Http-Proxy when httpProxy is provided', async () => {
    const { fetchByInternalReverseProxy } = await loadSubject()
    const fetchMock = vi.mocked(fetch)

    await fetchByInternalReverseProxy('https://api.themoviedb.org/3', '/movie/1', {
      httpProxy: '  http://127.0.0.1:7890  ',
    })

    const headers = headersOf(fetchMock.mock.calls[0]![1])
    expect(headers['x-http-proxy']).toBe('http://127.0.0.1:7890')
  })

  it('does not set X-Http-Proxy when httpProxy is empty', async () => {
    const { fetchByInternalReverseProxy } = await loadSubject()
    const fetchMock = vi.mocked(fetch)

    await fetchByInternalReverseProxy('https://api.themoviedb.org/3', '/movie/1', {
      httpProxy: '',
    })

    const headers = headersOf(fetchMock.mock.calls[0]![1])
    expect(headers['x-http-proxy']).toBeUndefined()
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ viaHttpProxy: false }),
      'reverse proxy request',
    )
  })

  it('logs debug context when httpProxy is provided', async () => {
    const { fetchByInternalReverseProxy } = await loadSubject()

    await fetchByInternalReverseProxy('https://api.themoviedb.org/3', '/movie/1', {
      httpProxy: 'http://192.168.50.10:7897',
    })

    expect(mockLogger.debug).toHaveBeenCalledWith(
      {
        path: '/movie/1',
        upstream: 'https://api.themoviedb.org/3',
        viaHttpProxy: true,
        httpProxyHost: '192.168.50.10:7897',
      },
      'reverse proxy request',
    )
  })

  it('preserves caller headers and init options', async () => {
    const { fetchByInternalReverseProxy } = await loadSubject()
    const fetchMock = vi.mocked(fetch)
    const signal = AbortSignal.abort()

    await fetchByInternalReverseProxy('https://api.themoviedb.org/3', '/movie/1', {
      method: 'GET',
      signal,
      headers: { Authorization: 'Bearer token' },
    })

    const init = fetchMock.mock.calls[0]![1]
    expect(init?.method).toBe('GET')
    expect(init?.signal).toBe(signal)
    const headers = headersOf(init)
    expect(headers['authorization']).toBe('Bearer token')
    expect(headers['x-smm-proxy-upstream-baseurl']).toBe('https://api.themoviedb.org/3')
  })

  it('defaults to GET and cache no-store', async () => {
    const { fetchByInternalReverseProxy } = await loadSubject()
    const fetchMock = vi.mocked(fetch)

    await fetchByInternalReverseProxy('https://api.themoviedb.org/3', '/movie/1')

    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      method: 'GET',
      cache: 'no-store',
    })
  })

  it('caches the reverse proxy URL across calls', async () => {
    const { fetchByInternalReverseProxy } = await loadSubject()

    await fetchByInternalReverseProxy('https://api.themoviedb.org/3', '/movie/1')
    await fetchByInternalReverseProxy('https://api.themoviedb.org/3', '/movie/2')

    expect(mockHello).toHaveBeenCalledTimes(1)
  })

  it('throws when reverseProxyUrl is unavailable', async () => {
    mockHello.mockResolvedValue({
      reverseProxyUrl: '',
      userDataDir: '/tmp/smm',
    } as Awaited<ReturnType<typeof hello>>)
    const { fetchByInternalReverseProxy } = await loadSubject()

    await expect(
      fetchByInternalReverseProxy('https://api.themoviedb.org/3', '/movie/1'),
    ).rejects.toThrow(
      'Reverse proxy URL is not available. Ensure the CLI started successfully and the hello task has completed.',
    )
  })
})
