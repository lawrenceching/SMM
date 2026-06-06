import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMovieById, getTMDBImageUrl, searchTmdb, getSeason, getTvShowById, getTmdbPrimaryTranslations, getTmdbLanguages } from './tmdb'

const REVERSE_PROXY_URL = 'http://127.0.0.1:30005'
const SMM_TMDB_DEFAULT_UPSTREAM = 'https://tmdb-mcp-server.imlc.me/api/tmdb'

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
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

  it('searches via reverse proxy with SMM-managed upstream when TMDB host is empty', async () => {
    const fetchSpy = mockOkJson({ results: [], page: 1, total_pages: 1, total_results: 0 })

    await searchTmdb('naruto', 'tv', 'en-US', { reverseProxyUrl: REVERSE_PROXY_URL })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe(
      `${REVERSE_PROXY_URL}/search/tv?query=naruto&language=en-US`,
    )
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['X-SMM-Proxy-Upstream-BaseURL']).toBe(SMM_TMDB_DEFAULT_UPSTREAM)
    expect(headers['Authorization']).toBeUndefined()
    expect(headers['X-TMDB-Host']).toBeUndefined()
    expect(headers['X-TMDB-API-Key']).toBeUndefined()
  })

  it('searches via reverse proxy with configured TMDB host and Authorization', async () => {
    const fetchSpy = mockOkJson({ results: [], page: 1, total_pages: 1, total_results: 0 })

    await searchTmdb('inception', 'movie', 'en-US', {
      reverseProxyUrl: REVERSE_PROXY_URL,
      upstreamBaseURL: 'https://api.themoviedb.org/3/',
      apiKey: 'abc123',
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe(
      `${REVERSE_PROXY_URL}/search/movie?query=inception&language=en-US`,
    )
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    // Trailing slash from user input is stripped.
    expect(headers['X-SMM-Proxy-Upstream-BaseURL']).toBe('https://api.themoviedb.org/3')
    expect(headers['Authorization']).toBe('Bearer abc123')
    expect(headers['X-TMDB-Host']).toBeUndefined()
    expect(headers['X-TMDB-API-Key']).toBeUndefined()
  })

  it('uses per-request overrides over the singleton', async () => {
    const fetchSpy = mockOkJson({ id: 1 })

    await getMovieById(1, 'en-US', {
      reverseProxyUrl: REVERSE_PROXY_URL,
      upstreamBaseURL: 'https://api.themoviedb.org/3',
      apiKey: 'override-key',
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe(`${REVERSE_PROXY_URL}/movie/1?language=en-US`)
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['X-SMM-Proxy-Upstream-BaseURL']).toBe('https://api.themoviedb.org/3')
    expect(headers['Authorization']).toBe('Bearer override-key')
  })

  it('routes getTvShowById through reverse proxy', async () => {
    const fetchSpy = mockOkJson({ id: 84666 })

    await getTvShowById(84666, 'zh-CN', { reverseProxyUrl: REVERSE_PROXY_URL })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe(`${REVERSE_PROXY_URL}/tv/84666?language=zh-CN`)
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['X-SMM-Proxy-Upstream-BaseURL']).toBe(SMM_TMDB_DEFAULT_UPSTREAM)
  })

  it('routes getSeason through reverse proxy', async () => {
    const fetchSpy = mockOkJson({ id: 1, episodes: [] })

    await getSeason(84666, 1, 'en-US', { reverseProxyUrl: REVERSE_PROXY_URL })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe(
      `${REVERSE_PROXY_URL}/tv/84666/season/1?language=en-US`,
    )
  })

  it('throws a clear error when no reverse proxy URL is available', async () => {
    await expect(searchTmdb('naruto', 'tv', 'en-US', { reverseProxyUrl: null })).rejects.toThrow(
      /Reverse proxy URL is not available/,
    )
  })
})

describe('getTmdbPrimaryTranslations', () => {
  function mockOkJson(body: unknown) {
    return vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
  }

  it('fetches the IETF primary translation list through the reverse proxy', async () => {
    const fetchSpy = mockOkJson(['en-US', 'zh-CN', 'fr-FR'])

    const result = await getTmdbPrimaryTranslations({ reverseProxyUrl: REVERSE_PROXY_URL })

    expect(result).toEqual(['en-US', 'zh-CN', 'fr-FR'])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe(`${REVERSE_PROXY_URL}/configuration/primary_translations`)
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['X-SMM-Proxy-Upstream-BaseURL']).toBe(SMM_TMDB_DEFAULT_UPSTREAM)
  })

  it('throws a clear error when no reverse proxy URL is available', async () => {
    await expect(getTmdbPrimaryTranslations({ reverseProxyUrl: null })).rejects.toThrow(
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

  it('fetches the language list (iso_639_1, english_name, name) through the reverse proxy', async () => {
    const fetchSpy = mockOkJson([
      { iso_639_1: 'en', english_name: 'English', name: 'English' },
      { iso_639_1: 'zh', english_name: 'Chinese', name: '中文' },
    ])

    const result = await getTmdbLanguages({ reverseProxyUrl: REVERSE_PROXY_URL })

    expect(result).toEqual([
      { iso_639_1: 'en', english_name: 'English', name: 'English' },
      { iso_639_1: 'zh', english_name: 'Chinese', name: '中文' },
    ])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe(`${REVERSE_PROXY_URL}/configuration/languages`)
  })

  it('throws a clear error when no reverse proxy URL is available', async () => {
    await expect(getTmdbLanguages({ reverseProxyUrl: null })).rejects.toThrow(
      /Reverse proxy URL is not available/,
    )
  })
})
