import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  searchInTmdb: vi.fn(),
  getMovieInTmdb: vi.fn(),
  getTvShowInTmdb: vi.fn(),
}))

vi.mock('../core/getCore', () => ({
  getCore: () => mocks,
}))

import { handleTmdb } from './Tmdb'

describe('TMDB Internal HTTP APIs', () => {
  let app: Hono

  beforeEach(() => {
    mocks.searchInTmdb.mockReset()
    mocks.getMovieInTmdb.mockReset()
    mocks.getTvShowInTmdb.mockReset()
    app = new Hono()
    handleTmdb(app)
  })

  async function post(path: string, body: unknown) {
    return app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  describe('POST /api/search-in-tmdb', () => {
    it('returns Error Reason when keyword is missing', async () => {
      const res = await post('/api/search-in-tmdb', { type: 'tv' })
      expect(res.status).toBe(200)
      const json = (await res.json()) as { error?: string }
      expect(json.error).toMatch(/^Error Reason: keyword is required/)
      expect(mocks.searchInTmdb).not.toHaveBeenCalled()
    })

    it('returns Error Reason when type is invalid', async () => {
      const res = await post('/api/search-in-tmdb', { keyword: 'naruto', type: 'anime' })
      expect(res.status).toBe(200)
      const json = (await res.json()) as { error?: string }
      expect(json.error).toMatch(/^Error Reason: type must be tv or movie/)
    })

    it('calls Core.searchInTmdb and returns data', async () => {
      mocks.searchInTmdb.mockResolvedValue({
        results: [{ id: 1, name: 'Naruto' }],
        page: 1,
        total_pages: 1,
        total_results: 1,
      })
      const res = await post('/api/search-in-tmdb', {
        keyword: 'naruto',
        type: 'tv',
        language: 'zh-CN',
        host: 'https://tmdb.example/3',
      })
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({
        data: {
          results: [{ id: 1, name: 'Naruto' }],
          page: 1,
          total_pages: 1,
          total_results: 1,
        },
      })
      expect(mocks.searchInTmdb).toHaveBeenCalledWith('naruto', {
        type: 'tv',
        language: 'zh-CN',
        host: 'https://tmdb.example/3',
        password: undefined,
        proxy: undefined,
      })
    })

    it('maps Core throw to Error Reason', async () => {
      mocks.searchInTmdb.mockRejectedValue(new Error('Unsupported language "cn"'))
      const res = await post('/api/search-in-tmdb', { keyword: 'x', type: 'movie', language: 'cn' })
      expect(res.status).toBe(200)
      const json = (await res.json()) as { error?: string }
      expect(json.error).toBe('Error Reason: Unsupported language "cn"')
    })
  })

  describe('POST /api/get-movie-in-tmdb', () => {
    it('returns Error Reason when id is missing', async () => {
      const res = await post('/api/get-movie-in-tmdb', {})
      expect(res.status).toBe(200)
      const json = (await res.json()) as { error?: string }
      expect(json.error).toMatch(/^Error Reason: id is required/)
    })

    it('calls Core.getMovieInTmdb and returns data', async () => {
      mocks.getMovieInTmdb.mockResolvedValue({ id: 550, title: 'Fight Club' })
      const res = await post('/api/get-movie-in-tmdb', { id: 550, language: 'en-US' })
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({
        data: { id: 550, title: 'Fight Club' },
      })
      expect(mocks.getMovieInTmdb).toHaveBeenCalledWith(550, {
        language: 'en-US',
        host: undefined,
        password: undefined,
        proxy: undefined,
      })
    })
  })

  describe('POST /api/get-tvshow-in-tmdb', () => {
    it('returns Error Reason when id is not a positive integer', async () => {
      const res = await post('/api/get-tvshow-in-tmdb', { id: 0 })
      expect(res.status).toBe(200)
      const json = (await res.json()) as { error?: string }
      expect(json.error).toMatch(/^Error Reason: id is required/)
    })

    it('calls Core.getTvShowInTmdb and returns data', async () => {
      mocks.getTvShowInTmdb.mockResolvedValue({ id: 1396, name: 'Breaking Bad' })
      const res = await post('/api/get-tvshow-in-tmdb', { id: 1396 })
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({
        data: { id: 1396, name: 'Breaking Bad' },
      })
      expect(mocks.getTvShowInTmdb).toHaveBeenCalledWith(1396, {
        language: undefined,
        host: undefined,
        password: undefined,
        proxy: undefined,
      })
    })
  })
})
