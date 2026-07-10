import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserConfig } from '@core/types'
import { fetchDiscoverConfig, type DiscoverConfig } from './discover'
import localStorages from '@/lib/localStorages'
import { defaultUserConfig, readUserConfig } from './readUserConfig'
import { hello } from './hello'

vi.mock('./readUserConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./readUserConfig')>()
  return {
    ...actual,
    readUserConfig: vi.fn(),
  }
})

vi.mock('./hello', () => ({
  hello: vi.fn(),
}))

vi.mock('./discover', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./discover')>()
  return {
    ...actual,
    fetchDiscoverConfig: vi.fn(),
  }
})

import { fetchTvdb, SMM_TVDB_DEFAULT_UPSTREAM } from './tvdb'
import { _resetInternalReverseProxyCacheForTesting } from './fetchByInternalReverseProxy'

const REVERSE_PROXY_URL = 'http://127.0.0.1:30005'

const mockReadUserConfig = vi.mocked(readUserConfig)
const mockHello = vi.mocked(hello)
const mockFetchDiscoverConfig = vi.mocked(fetchDiscoverConfig)

function userConfigWithTvdb(
  tvdb: Partial<NonNullable<UserConfig['tvdb']>> = {},
): UserConfig {
  return {
    ...defaultUserConfig,
    tvdb: {
      host: '',
      apiKey: '',
      ...tvdb,
    },
  }
}

function okResponse(body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, statusText: 'OK' })
}

function headersOf(init: RequestInit | undefined): Record<string, string> {
  const h = init?.headers
  if (!h) return {}
  if (h instanceof Headers) {
    const out: Record<string, string> = {}
    h.forEach((v, k) => {
      out[k] = v
    })
    return out
  }
  return { ...(h as Record<string, string>) }
}

const discoverConfig: DiscoverConfig = {
  mediaDatabases: [
    {
      type: 'tvdb',
      url: 'https://tvdb-a.example/api/tvdb',
      authorizationMethod: 'none',
    },
  ],
  reverseProxies: [
    {
      id: 'proxy-a',
      type: 'general',
      url: 'https://proxy-a.example',
      authorizationMethod: 'date-token',
    },
  ],
}

beforeEach(() => {
  vi.restoreAllMocks()
  localStorages.disabledDomains = new Set()
  _resetInternalReverseProxyCacheForTesting()
  mockReadUserConfig.mockResolvedValue(userConfigWithTvdb())
  mockHello.mockResolvedValue({
    reverseProxyUrl: REVERSE_PROXY_URL,
    userDataDir: '/tmp/smm',
  } as Awaited<ReturnType<typeof hello>>)
  mockFetchDiscoverConfig.mockResolvedValue(discoverConfig)
})

afterEach(() => {
  localStorages.disabledDomains = new Set()
})

describe('fetchTvdb', () => {
  describe('when user configures a custom TVDB host', () => {
    it('routes through the local reverse proxy with upstream headers', async () => {
      mockReadUserConfig.mockResolvedValue(
        userConfigWithTvdb({
          host: 'https://api4.thetvdb.com/v4/',
          apiKey: 'secret-key',
        }),
      )
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({ data: [] }))

      const resp = await fetchTvdb('/search?query=naruto')

      expect(resp.ok).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy.mock.calls[0]![0]).toBe(`${REVERSE_PROXY_URL}/search?query=naruto`)
      const headers = headersOf(fetchSpy.mock.calls[0]![1])
      expect(headers['X-SMM-Proxy-Upstream-BaseURL']).toBe('https://api4.thetvdb.com/v4')
      expect(headers.Authorization).toBe('Bearer secret-key')
      expect(fetchSpy.mock.calls[0]![1]).toMatchObject({
        method: 'GET',
        cache: 'no-store',
      })
    })

    it('normalizes urlPath without a leading slash', async () => {
      mockReadUserConfig.mockResolvedValue(
        userConfigWithTvdb({ host: 'https://api4.thetvdb.com/v4' }),
      )
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())

      await fetchTvdb('series/1/extended')

      expect(fetchSpy.mock.calls[0]![0]).toBe(`${REVERSE_PROXY_URL}/series/1/extended`)
    })

    it('throws when reverse proxy URL is unavailable', async () => {
      mockReadUserConfig.mockResolvedValue(
        userConfigWithTvdb({ host: 'https://api4.thetvdb.com/v4' }),
      )
      mockHello.mockResolvedValue({
        reverseProxyUrl: null,
        userDataDir: '/tmp/smm',
      } as Awaited<ReturnType<typeof hello>>)

      await expect(fetchTvdb('/search')).rejects.toThrow(
        /Reverse proxy URL is not available/,
      )
    })

    it('forwards AbortSignal to fetch', async () => {
      mockReadUserConfig.mockResolvedValue(
        userConfigWithTvdb({ host: 'https://api4.thetvdb.com/v4' }),
      )
      const controller = new AbortController()
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())

      await fetchTvdb('/search', { signal: controller.signal })

      expect(fetchSpy.mock.calls[0]![1]).toMatchObject({
        signal: controller.signal,
      })
    })
  })

  describe('when no custom TVDB host is configured', () => {
    it('uses default upstream when tvdb config is missing from user config', async () => {
      mockReadUserConfig.mockResolvedValue({
        ...defaultUserConfig,
        tvdb: undefined as unknown as UserConfig['tvdb'],
      })
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())

      await fetchTvdb('/search', {
        config: { mediaDatabases: [], reverseProxies: [] },
      })

      expect(fetchSpy.mock.calls[0]![0]).toBe(
        `${SMM_TVDB_DEFAULT_UPSTREAM}/search`,
      )
    })

    it('forwards AbortSignal to direct and proxy fetch attempts', async () => {
      const controller = new AbortController()
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(okResponse())

      await fetchTvdb('/search?query=naruto', {
        config: discoverConfig,
        signal: controller.signal,
      })

      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(fetchSpy.mock.calls[0]![1]).toMatchObject({ signal: controller.signal })
      expect(fetchSpy.mock.calls[1]![1]).toMatchObject({ signal: controller.signal })
    })

    it('rethrows AbortError without failing over or disabling domains', async () => {
      const abortError = new DOMException('aborted', 'AbortError')
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(abortError)

      await expect(
        fetchTvdb('/search', {
          config: discoverConfig,
          signal: new AbortController().signal,
        }),
      ).rejects.toSatisfy(
        (err: unknown) => err instanceof DOMException && err.name === 'AbortError',
      )

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(localStorages.disabledDomains.size).toBe(0)
    })

    it('tries the discovered TVDB host directly first', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({ data: [] }))

      const resp = await fetchTvdb('/search?query=naruto', { config: discoverConfig })

      expect(resp!.ok).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy.mock.calls[0]![0]).toBe(
        'https://tvdb-a.example/api/tvdb/search?query=naruto',
      )
    })

    it('fails over to a reverse proxy with date-token auth when direct fetch throws', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(okResponse({ data: [] }))

      const resp = await fetchTvdb('/search?query=naruto', {
        config: discoverConfig,
      })

      expect(resp!.ok).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(fetchSpy.mock.calls[1]![0]).toBe('https://proxy-a.example')
      const headers = headersOf(fetchSpy.mock.calls[1]![1])
      expect(headers['X-Upstream-Base-Url']).toBe('https://tvdb-a.example/api/tvdb')
      expect(headers['X-Proxy-Authorization']).toMatch(/^Bearer \d{8}$/)
    })

    it('records the failed direct host in disabledDomains before failover', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(okResponse())

      await fetchTvdb('/search', { config: discoverConfig })

      expect(localStorages.disabledDomains.has('tvdb-a.example')).toBe(true)
    })

    it('skips hosts and proxies listed in disabledDomains', async () => {
      const config: DiscoverConfig = {
        mediaDatabases: [
          {
            type: 'tvdb',
            url: 'https://disabled-tvdb.example/api/tvdb',
            authorizationMethod: 'none',
          },
          {
            type: 'tvdb',
            url: 'https://live-tvdb.example/api/tvdb',
            authorizationMethod: 'none',
          },
        ],
        reverseProxies: [
          {
            id: 'disabled-proxy',
            type: 'general',
            url: 'https://disabled-proxy.example',
            authorizationMethod: 'none',
          },
          {
            id: 'live-proxy',
            type: 'general',
            url: 'https://live-proxy.example',
            authorizationMethod: 'none',
          },
        ],
      }
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())

      await fetchTvdb('/search', {
        config,
        disabledDomains: new Set(['disabled-tvdb.example', 'disabled-proxy.example']),
      })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy.mock.calls[0]![0]).toBe(
        'https://live-tvdb.example/api/tvdb/search',
      )
    })

    it('uses default host and proxy when discover lists are empty', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())

      await fetchTvdb('/search', {
        config: { mediaDatabases: [], reverseProxies: [] },
      })

      expect(fetchSpy.mock.calls[0]![0]).toBe(
        `${SMM_TVDB_DEFAULT_UPSTREAM}/search`,
      )
    })

    it('clears disabled domains from the discover config when every attempt fails', async () => {
      localStorages.disabledDomains = new Set([
        'tvdb-a.example',
        'proxy-a.example',
        'unrelated.example',
      ])
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

      const resp = await fetchTvdb('/search', {
        config: discoverConfig,
        disabledDomains: new Set(),
      })

      expect(resp).toBeUndefined()
      expect([...localStorages.disabledDomains]).toEqual(['unrelated.example'])
    })

    it('ignores TMDB hosts from discover config', async () => {
      const config: DiscoverConfig = {
        mediaDatabases: [
          {
            type: 'tmdb',
            url: 'https://tmdb-only.example/api/tmdb',
            authorizationMethod: 'none',
          },
          {
            type: 'tvdb',
            url: 'https://tvdb-live.example/api/tvdb',
            authorizationMethod: 'none',
          },
        ],
        reverseProxies: [],
      }
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())

      await fetchTvdb('/search', { config })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy.mock.calls[0]![0]).toBe(
        'https://tvdb-live.example/api/tvdb/search',
      )
    })
  })
})
