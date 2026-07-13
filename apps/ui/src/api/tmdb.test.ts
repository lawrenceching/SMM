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

import {
  clearDisabledDomains,
  fetchTmdb,
  getMovieById,
  getTMDBImageUrl,
  searchTmdb,
  getSeason,
  getTvShowById,
  getTmdbPrimaryTranslations,
  getTmdbLanguages,
} from './tmdb'
import { _resetInternalReverseProxyCacheForTesting } from './fetchByInternalReverseProxy'

const REVERSE_PROXY_URL = 'http://127.0.0.1:30005'
const SMM_TMDB_DEFAULT_UPSTREAM = 'https://mediadb.vercel.app/api/tmdb'

const mockReadUserConfig = vi.mocked(readUserConfig)
const mockHello = vi.mocked(hello)
const mockFetchDiscoverConfig = vi.mocked(fetchDiscoverConfig)

function userConfigWithTmdb(
  tmdb: Partial<UserConfig['tmdb']> = {},
): UserConfig {
  return {
    ...defaultUserConfig,
    tmdb: {
      host: '',
      apiKey: '',
      httpProxy: '',
      ...tmdb,
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
      type: 'tmdb',
      url: 'https://tmdb-a.example/api/tmdb',
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
  mockReadUserConfig.mockResolvedValue(userConfigWithTmdb())
  mockHello.mockResolvedValue({
    reverseProxyUrl: REVERSE_PROXY_URL,
    userDataDir: '/tmp/smm',
  } as Awaited<ReturnType<typeof hello>>)
  mockFetchDiscoverConfig.mockResolvedValue(discoverConfig)
})

afterEach(() => {
  localStorages.disabledDomains = new Set()
})

describe('clearDisabledDomains', () => {
  it('removes the given domains from localStorages.disabledDomains and keeps others', () => {
    localStorages.disabledDomains = new Set([
      'mediadb.vercel.app',
      'proxy.example.com',
      'unrelated.example',
    ])

    clearDisabledDomains(['mediadb.vercel.app', 'proxy.example.com', ''])

    expect([...localStorages.disabledDomains]).toEqual(['unrelated.example'])
  })
})

describe('fetchTmdb', () => {
  describe('when user configures a custom TMDB host', () => {
    it('routes through the local reverse proxy with upstream headers', async () => {
      mockReadUserConfig.mockResolvedValue(
        userConfigWithTmdb({
          host: 'https://api.themoviedb.org/3/',
          apiKey: 'secret-key',
          httpProxy: 'http://127.0.0.1:7890',
        }),
      )
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({ id: 1 }))

      const resp = await fetchTmdb('/search/tv?query=naruto')

      expect(resp.ok).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy.mock.calls[0]![0]).toBe(`${REVERSE_PROXY_URL}/search/tv?query=naruto`)
      const headers = headersOf(fetchSpy.mock.calls[0]![1])
      expect(headers['X-SMM-Proxy-Upstream-BaseURL']).toBe('https://api.themoviedb.org/3')
      expect(headers.Authorization).toBe('Bearer secret-key')
      expect(headers['X-Http-Proxy']).toBe('http://127.0.0.1:7890')
      expect(fetchSpy.mock.calls[0]![1]).toMatchObject({
        method: 'GET',
        cache: 'no-store',
      })
    })

    it('normalizes urlPath without a leading slash', async () => {
      mockReadUserConfig.mockResolvedValue(
        userConfigWithTmdb({ host: 'https://api.themoviedb.org/3' }),
      )
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())

      await fetchTmdb('movie/1')

      expect(fetchSpy.mock.calls[0]![0]).toBe(`${REVERSE_PROXY_URL}/movie/1`)
    })

    it('throws when reverse proxy URL is unavailable', async () => {
      mockReadUserConfig.mockResolvedValue(
        userConfigWithTmdb({ host: 'https://api.themoviedb.org/3' }),
      )
      mockHello.mockResolvedValue({
        reverseProxyUrl: null,
        userDataDir: '/tmp/smm',
      } as Awaited<ReturnType<typeof hello>>)

      await expect(fetchTmdb('/search/tv')).rejects.toThrow(
        /Reverse proxy URL is not available/,
      )
    })

    it('forwards AbortSignal to fetch', async () => {
      mockReadUserConfig.mockResolvedValue(
        userConfigWithTmdb({ host: 'https://api.themoviedb.org/3' }),
      )
      const controller = new AbortController()
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())

      await fetchTmdb('/search/tv', { signal: controller.signal })

      expect(fetchSpy.mock.calls[0]![1]).toMatchObject({
        signal: controller.signal,
      })
    })
  })

  describe('when no custom TMDB host is configured', () => {
    it('uses default upstream when tmdb config is missing from user config', async () => {
      mockReadUserConfig.mockResolvedValue({
        ...defaultUserConfig,
        tmdb: undefined as unknown as UserConfig['tmdb'],
      })
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())

      await fetchTmdb('/search/tv', {
        config: { mediaDatabases: [], reverseProxies: [] },
      })

      expect(fetchSpy.mock.calls[0]![0]).toBe(
        `${SMM_TMDB_DEFAULT_UPSTREAM}/search/tv`,
      )
    })

    it('forwards AbortSignal to direct and proxy fetch attempts', async () => {
      const controller = new AbortController()
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(okResponse())

      await fetchTmdb('/search/tv', {
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
        fetchTmdb('/search/tv', {
          config: discoverConfig,
          signal: new AbortController().signal,
        }),
      ).rejects.toSatisfy(
        (err: unknown) => err instanceof DOMException && err.name === 'AbortError',
      )

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(localStorages.disabledDomains.size).toBe(0)
    })

    it('tries the discovered reverse proxy first', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({ results: [] }))

      const resp = await fetchTmdb('/search/tv?query=naruto', { config: discoverConfig })

      expect(resp!.ok).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy.mock.calls[0]![0]).toBe('https://proxy-a.example')
      const headers = headersOf(fetchSpy.mock.calls[0]![1])
      expect(headers['X-Upstream-Base-Url']).toBe('https://tmdb-a.example/api/tmdb')
      expect(headers['X-Proxy-Authorization']).toMatch(/^Bearer \d{8}$/)
    })

    it('fails over to the discovered TMDB host when reverse proxy throws', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(okResponse({ results: [] }))

      const resp = await fetchTmdb('/search/movie?query=inception', {
        config: discoverConfig,
      })

      expect(resp!.ok).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(fetchSpy.mock.calls[0]![0]).toBe('https://proxy-a.example')
      expect(fetchSpy.mock.calls[1]![0]).toBe(
        'https://tmdb-a.example/api/tmdb/search/movie?query=inception',
      )
    })

    it('records the failed reverse proxy in disabledDomains before failover', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(okResponse())

      await fetchTmdb('/search/tv', { config: discoverConfig })

      expect(localStorages.disabledDomains.has('proxy-a.example')).toBe(true)
    })

    it('skips hosts and proxies listed in disabledDomains', async () => {
      const config: DiscoverConfig = {
        mediaDatabases: [
          {
            type: 'tmdb',
            url: 'https://disabled-tmdb.example/api/tmdb',
            authorizationMethod: 'none',
          },
          {
            type: 'tmdb',
            url: 'https://live-tmdb.example/api/tmdb',
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

      await fetchTmdb('/search/tv', {
        config,
        disabledDomains: new Set(['disabled-tmdb.example', 'disabled-proxy.example']),
      })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy.mock.calls[0]![0]).toBe('https://live-proxy.example')
      const headers = headersOf(fetchSpy.mock.calls[0]![1])
      expect(headers['X-Upstream-Base-Url']).toBe('https://live-tmdb.example/api/tmdb')
    })

    it('uses default host and proxy when discover lists are empty', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())

      await fetchTmdb('/search/tv', {
        config: { mediaDatabases: [], reverseProxies: [] },
      })

      expect(fetchSpy.mock.calls[0]![0]).toBe(
        `${SMM_TMDB_DEFAULT_UPSTREAM}/search/tv`,
      )
    })

    it('clears disabled domains from the discover config when every attempt fails', async () => {
      localStorages.disabledDomains = new Set([
        'tmdb-a.example',
        'proxy-a.example',
        'unrelated.example',
      ])
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

      // Pass an empty in-memory set so this attempt still tries the discover candidates.
      const resp = await fetchTmdb('/search/tv', {
        config: discoverConfig,
        disabledDomains: new Set(),
      })

      expect(resp).toBeUndefined()
      expect([...localStorages.disabledDomains]).toEqual(['unrelated.example'])
    })
  })
})

describe('getTMDBImageUrl', () => {
  describe('backdrop_path handling', () => {
    describe('null/undefined handling', () => {
      it('should return null when path is null', () => {
        expect(getTMDBImageUrl(null)).toBeNull()
      })

      it('should return null when path is undefined', () => {
        expect(getTMDBImageUrl(undefined)).toBeNull()
      })

      it('should return null when path is not provided', () => {
        expect(getTMDBImageUrl()).toBeNull()
      })
    })

    describe('empty/invalid input handling', () => {
      it('should return null when path is an empty string', () => {
        expect(getTMDBImageUrl('')).toBeNull()
      })

      it('should return null when path is whitespace only', () => {
        expect(getTMDBImageUrl('   ')).toBeNull()
      })

      it('should return null when path is a number', () => {
        expect(getTMDBImageUrl(123 as unknown as string)).toBeNull()
      })

      it('should return null when path is an object', () => {
        expect(getTMDBImageUrl({} as unknown as string)).toBeNull()
      })
    })

    describe('relative path handling (TMDB format)', () => {
      it('should construct URL for relative backdrop_path with default size', () => {
        const backdropPath = '/abc123backdrop.jpg'
        const result = getTMDBImageUrl(backdropPath)
        expect(result).toBe('https://image.tmdb.org/t/p/w500/abc123backdrop.jpg')
      })

      it('should construct URL for relative backdrop_path with w780 size', () => {
        const backdropPath = '/xyz789backdrop.jpg'
        const result = getTMDBImageUrl(backdropPath, 'w780')
        expect(result).toBe('https://image.tmdb.org/t/p/w780/xyz789backdrop.jpg')
      })

      it('should construct URL for relative backdrop_path with original size', () => {
        const backdropPath = '/originalbackdrop.jpg'
        const result = getTMDBImageUrl(backdropPath, 'original')
        expect(result).toBe('https://image.tmdb.org/t/p/original/originalbackdrop.jpg')
      })

      it('should handle backdrop_path with leading slash', () => {
        const backdropPath = '/backdrop.jpg'
        const result = getTMDBImageUrl(backdropPath, 'w780')
        expect(result).toBe('https://image.tmdb.org/t/p/w780/backdrop.jpg')
      })

      it('should trim whitespace from relative path', () => {
        const backdropPath = '  /backdrop.jpg  '
        const result = getTMDBImageUrl(backdropPath, 'w780')
        expect(result).toBe('https://image.tmdb.org/t/p/w780/backdrop.jpg')
      })
    })

    describe('absolute URL handling', () => {
      it('should return HTTPS URL directly without modification', () => {
        const backdropPath = 'https://example.com/backdrop.jpg'
        const result = getTMDBImageUrl(backdropPath, 'w780')
        expect(result).toBe('https://example.com/backdrop.jpg')
      })

      it('should return HTTP URL directly without modification', () => {
        const backdropPath = 'http://example.com/backdrop.jpg'
        const result = getTMDBImageUrl(backdropPath, 'w780')
        expect(result).toBe('http://example.com/backdrop.jpg')
      })

      it('should handle external HTTPS URL with various sizes', () => {
        const backdropPath = 'https://cdn.example.com/images/backdrop.png'
        const result = getTMDBImageUrl(backdropPath, 'original')
        expect(result).toBe('https://cdn.example.com/images/backdrop.png')
      })

      it('should trim whitespace from absolute URL', () => {
        const backdropPath = '  https://example.com/backdrop.jpg  '
        const result = getTMDBImageUrl(backdropPath, 'w780')
        expect(result).toBe('https://example.com/backdrop.jpg')
      })
    })

    describe('size parameter handling', () => {
      it('should use default w500 size when not specified', () => {
        const backdropPath = '/backdrop.jpg'
        const result = getTMDBImageUrl(backdropPath)
        expect(result).toContain('/w500/')
      })

      it('should work with all supported sizes', () => {
        const backdropPath = '/backdrop.jpg'
        const sizes = ['w200', 'w300', 'w500', 'w780', 'original'] as const

        sizes.forEach(size => {
          const result = getTMDBImageUrl(backdropPath, size)
          expect(result).toContain(`/p/${size}/`)
        })
      })
    })
  })
})

describe('tmdb routing through reverse proxy', () => {
  function mockOkJson(body: unknown) {
    return vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
  }

  it('searches via discovered reverse proxy when TMDB host is empty', async () => {
    mockReadUserConfig.mockResolvedValue(userConfigWithTmdb())
    const fetchSpy = mockOkJson({ results: [], page: 1, total_pages: 1, total_results: 0 })

    const result = await searchTmdb('naruto', 'tv', 'en-US')

    expect(result).toEqual({ results: [], page: 1, total_pages: 1, total_results: 0 })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe('https://proxy-a.example')
    const headers = headersOf(fetchSpy.mock.calls[0][1] as RequestInit)
    expect(headers['X-Upstream-Base-Url']).toBe('https://tmdb-a.example/api/tmdb')
  })

  it('searches via reverse proxy with configured TMDB host and Authorization', async () => {
    mockReadUserConfig.mockResolvedValue(
      userConfigWithTmdb({
        host: 'https://api.themoviedb.org/3/',
        apiKey: 'abc123',
      }),
    )
    const fetchSpy = mockOkJson({ results: [], page: 1, total_pages: 1, total_results: 0 })

    const result = await searchTmdb('inception', 'movie', 'en-US')

    expect(result).toEqual({ results: [], page: 1, total_pages: 1, total_results: 0 })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe(
      `${REVERSE_PROXY_URL}/search/movie?query=inception&language=en-US`,
    )
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    // Trailing slash from user input is stripped.
    expect(headers['X-SMM-Proxy-Upstream-BaseURL']).toBe('https://api.themoviedb.org/3')
    expect(headers['Authorization']).toBe('Bearer abc123')
  })

  it('routes getMovieById through reverse proxy with user config', async () => {
    mockReadUserConfig.mockResolvedValue(
      userConfigWithTmdb({
        host: 'https://api.themoviedb.org/3',
        apiKey: 'override-key',
      }),
    )
    const fetchSpy = mockOkJson({ id: 1 })

    const result = await getMovieById(1, 'en-US')

    expect(result).toEqual({ id: 1 })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe(`${REVERSE_PROXY_URL}/movie/1?language=en-US`)
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['X-SMM-Proxy-Upstream-BaseURL']).toBe('https://api.themoviedb.org/3')
    expect(headers['Authorization']).toBe('Bearer override-key')
  })

  it('routes getTvShowById through reverse proxy', async () => {
    mockReadUserConfig.mockResolvedValue(
      userConfigWithTmdb({ host: 'https://api.themoviedb.org/3' }),
    )
    const fetchSpy = mockOkJson({ id: 84666 })

    const result = await getTvShowById(84666, 'zh-CN')

    expect(result).toEqual({ id: 84666 })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe(`${REVERSE_PROXY_URL}/tv/84666?language=zh-CN`)
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['X-SMM-Proxy-Upstream-BaseURL']).toBe('https://api.themoviedb.org/3')
  })

  it('routes getSeason through reverse proxy', async () => {
    mockReadUserConfig.mockResolvedValue(
      userConfigWithTmdb({ host: 'https://api.themoviedb.org/3' }),
    )
    const fetchSpy = mockOkJson({ id: 1, episodes: [] })

    const result = await getSeason(84666, 1, 'en-US')

    expect(result).toEqual({ id: 1, episodes: [] })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe(
      `${REVERSE_PROXY_URL}/tv/84666/season/1?language=en-US`,
    )
  })

  it('throws a clear error when no reverse proxy URL is available', async () => {
    mockReadUserConfig.mockResolvedValue(
      userConfigWithTmdb({ host: 'https://api.themoviedb.org/3' }),
    )
    mockHello.mockResolvedValue({
      reverseProxyUrl: null,
      userDataDir: '/tmp/smm',
    } as Awaited<ReturnType<typeof hello>>)

    await expect(searchTmdb('naruto', 'tv', 'en-US')).rejects.toThrow(
      /Reverse proxy URL is not available/,
    )
  })

  it('forwards signal to the underlying fetch', async () => {
    mockReadUserConfig.mockResolvedValue(
      userConfigWithTmdb({ host: 'https://api.themoviedb.org/3' }),
    )
    const controller = new AbortController()
    const fetchSpy = mockOkJson({ results: [] })

    await searchTmdb('naruto', 'tv', 'en-US', { signal: controller.signal })

    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ signal: controller.signal })
  })

  it('throws when fetchTmdb returns undefined (all attempts failed)', async () => {
    mockReadUserConfig.mockResolvedValue(userConfigWithTmdb())
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(searchTmdb('naruto', 'tv', 'en-US')).rejects.toThrow(
      /Failed to search TMDB: all attempts failed/,
    )
  })

  it('throws when fetchTmdb returns a non-ok response', async () => {
    mockReadUserConfig.mockResolvedValue(
      userConfigWithTmdb({ host: 'https://api.themoviedb.org/3' }),
    )
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404, statusText: 'Not Found' }),
    )

    await expect(searchTmdb('naruto', 'tv', 'en-US')).rejects.toThrow(
      /Failed to search TMDB: 404 Not Found/,
    )
  })
})

describe('getTmdbPrimaryTranslations', () => {
  function mockOkJson(body: unknown) {
    return vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
  }

  it('fetches the IETF primary translation list through fetchTmdb', async () => {
    mockReadUserConfig.mockResolvedValue(
      userConfigWithTmdb({ host: 'https://api.themoviedb.org/3' }),
    )
    const fetchSpy = mockOkJson(['en-US', 'zh-CN', 'fr-FR'])

    const result = await getTmdbPrimaryTranslations()

    expect(result).toEqual(['en-US', 'zh-CN', 'fr-FR'])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe(
      `${REVERSE_PROXY_URL}/configuration/primary_translations`,
    )
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['X-SMM-Proxy-Upstream-BaseURL']).toBe('https://api.themoviedb.org/3')
  })

  it('throws a clear error when no reverse proxy URL is available', async () => {
    mockReadUserConfig.mockResolvedValue(
      userConfigWithTmdb({ host: 'https://api.themoviedb.org/3' }),
    )
    mockHello.mockResolvedValue({
      reverseProxyUrl: null,
      userDataDir: '/tmp/smm',
    } as Awaited<ReturnType<typeof hello>>)

    await expect(getTmdbPrimaryTranslations()).rejects.toThrow(
      /Reverse proxy URL is not available/,
    )
  })
})

describe('getTmdbLanguages', () => {
  function mockOkJson(body: unknown) {
    return vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
  }

  it('fetches the language list (iso_639_1, english_name, name) through fetchTmdb', async () => {
    mockReadUserConfig.mockResolvedValue(
      userConfigWithTmdb({ host: 'https://api.themoviedb.org/3' }),
    )
    const fetchSpy = mockOkJson([
      { iso_639_1: 'en', english_name: 'English', name: 'English' },
      { iso_639_1: 'zh', english_name: 'Chinese', name: '中文' },
    ])

    const result = await getTmdbLanguages()

    expect(result).toEqual([
      { iso_639_1: 'en', english_name: 'English', name: 'English' },
      { iso_639_1: 'zh', english_name: 'Chinese', name: '中文' },
    ])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe(`${REVERSE_PROXY_URL}/configuration/languages`)
  })

  it('throws a clear error when no reverse proxy URL is available', async () => {
    mockReadUserConfig.mockResolvedValue(
      userConfigWithTmdb({ host: 'https://api.themoviedb.org/3' }),
    )
    mockHello.mockResolvedValue({
      reverseProxyUrl: null,
      userDataDir: '/tmp/smm',
    } as Awaited<ReturnType<typeof hello>>)

    await expect(getTmdbLanguages()).rejects.toThrow(
      /Reverse proxy URL is not available/,
    )
  })
})
