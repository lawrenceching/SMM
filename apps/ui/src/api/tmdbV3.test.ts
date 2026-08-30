import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMovieInTmdb, getTvShowInTmdb, searchInTmdb } from './tmdbV3'

vi.mock('@/lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}))

import { apiFetch } from '@/lib/apiFetch'

const mockApiFetch = vi.mocked(apiFetch)

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('tmdbV3 Internal HTTP clients', () => {
  beforeEach(() => {
    mockApiFetch.mockReset()
  })

  afterEach(() => {
    mockApiFetch.mockReset()
  })

  it('searchInTmdb POSTs keyword and type', async () => {
    mockApiFetch.mockResolvedValue(
      jsonResponse({
        data: { results: [{ id: 1 }], page: 1, total_pages: 1, total_results: 1 },
      }),
    )
    const body = await searchInTmdb({ keyword: 'naruto', type: 'tv', language: 'zh-CN' })
    expect(mockApiFetch).toHaveBeenCalledWith('/api/search-in-tmdb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: 'naruto', type: 'tv', language: 'zh-CN' }),
      signal: undefined,
    })
    expect(body.data?.total_results).toBe(1)
  })

  it('getMovieInTmdb POSTs id', async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({ data: { id: 550, title: 'Fight Club' } }))
    const body = await getMovieInTmdb({ id: 550 })
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/get-movie-in-tmdb',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id: 550 }),
      }),
    )
    expect(body.data?.title).toBe('Fight Club')
  })

  it('getTvShowInTmdb POSTs id', async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({ data: { id: 1396, name: 'Breaking Bad' } }))
    const body = await getTvShowInTmdb({ id: 1396, language: 'en-US' })
    expect(mockApiFetch.mock.calls[0]?.[0]).toBe('/api/get-tvshow-in-tmdb')
    expect(body.data?.name).toBe('Breaking Bad')
  })

  it('throws on HTTP layer failure', async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({ error: 'nope' }, 500))
    await expect(searchInTmdb({ keyword: 'x', type: 'movie' })).rejects.toThrow(/HTTP Layer Error/)
  })
})
