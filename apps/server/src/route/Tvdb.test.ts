import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  searchInTvdb: vi.fn(),
  getTvShowInTvdb: vi.fn(),
  getMovieInTvdb: vi.fn(),
  getTvdbLanguages: vi.fn(),
}))

vi.mock('../core/getCore', () => ({
  getCore: () => mocks,
}))

import { handleTvdb } from './Tvdb'

describe('TVDB Internal HTTP APIs', () => {
  let app: Hono

  beforeEach(() => {
    mocks.searchInTvdb.mockReset()
    mocks.getTvShowInTvdb.mockReset()
    mocks.getMovieInTvdb.mockReset()
    mocks.getTvdbLanguages.mockReset()
    app = new Hono()
    handleTvdb(app)
  })

  async function post(path: string, body: unknown) {
    return app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  describe('POST /api/search-in-tvdb', () => {
    it('returns Error Reason when keyword is missing', async () => {
      const res = await post('/api/search-in-tvdb', { type: 'series' })
      expect(res.status).toBe(200)
      const json = (await res.json()) as { error?: string }
      expect(json.error).toMatch(/^Error Reason: keyword is required/)
      expect(mocks.searchInTvdb).not.toHaveBeenCalled()
    })

    it('returns Error Reason when type is invalid', async () => {
      const res = await post('/api/search-in-tvdb', { keyword: 'naruto', type: 'anime' })
      expect(res.status).toBe(200)
      const json = (await res.json()) as { error?: string }
      expect(json.error).toMatch(/^Error Reason: type must be series or movie/)
    })

    it('calls Core.searchInTvdb and returns data', async () => {
      mocks.searchInTvdb.mockResolvedValue([{ tvdb_id: '1', name: 'Naruto' }])
      const res = await post('/api/search-in-tvdb', {
        keyword: 'naruto',
        type: 'series',
        language: 'zho',
        host: 'https://tvdb.example.com/v4',
      })
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({ data: [{ tvdb_id: '1', name: 'Naruto' }] })
      expect(mocks.searchInTvdb).toHaveBeenCalledWith('naruto', {
        type: 'series',
        language: 'zho',
        host: 'https://tvdb.example.com/v4',
        password: undefined,
        proxy: undefined,
      })
    })

    it('maps Core throw to Error Reason', async () => {
      mocks.searchInTvdb.mockRejectedValue(new Error('Unsupported language "zh-CN"'))
      const res = await post('/api/search-in-tvdb', { keyword: 'x', type: 'movie', language: 'zh-CN' })
      expect(res.status).toBe(200)
      const json = (await res.json()) as { error?: string }
      expect(json.error).toBe('Error Reason: Unsupported language "zh-CN"')
    })
  })

  describe('POST /api/get-tvshow-in-tvdb', () => {
    it('returns Error Reason when id is missing', async () => {
      const res = await post('/api/get-tvshow-in-tvdb', {})
      expect(res.status).toBe(200)
      const json = (await res.json()) as { error?: string }
      expect(json.error).toMatch(/^Error Reason: id is required/)
    })

    it('calls Core.getTvShowInTvdb and returns data', async () => {
      mocks.getTvShowInTvdb.mockResolvedValue({ id: '1', name: 'My Show', database: 'TVDB', seasons: [] })
      const res = await post('/api/get-tvshow-in-tvdb', { id: 1, language: 'eng' })
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({
        data: { id: '1', name: 'My Show', database: 'TVDB', seasons: [] },
      })
      expect(mocks.getTvShowInTvdb).toHaveBeenCalledWith(1, {
        language: 'eng',
        host: undefined,
        password: undefined,
        proxy: undefined,
      })
    })
  })

  describe('POST /api/get-movie-in-tvdb', () => {
    it('calls Core.getMovieInTvdb and returns data', async () => {
      mocks.getMovieInTvdb.mockResolvedValue({ id: '2', name: 'My Film', database: 'TVDB' })
      const res = await post('/api/get-movie-in-tvdb', { id: 2 })
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({ data: { id: '2', name: 'My Film', database: 'TVDB' } })
      expect(mocks.getMovieInTvdb).toHaveBeenCalledWith(2, {
        language: undefined,
        host: undefined,
        password: undefined,
        proxy: undefined,
      })
    })
  })

  describe('POST /api/get-tvdb-languages', () => {
    it('calls Core.getTvdbLanguages and returns data', async () => {
      mocks.getTvdbLanguages.mockResolvedValue([{ id: 'zho', name: 'Chinese' }])
      const res = await post('/api/get-tvdb-languages', {})
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({ data: [{ id: 'zho', name: 'Chinese' }] })
      expect(mocks.getTvdbLanguages).toHaveBeenCalledWith({
        language: undefined,
        host: undefined,
        password: undefined,
        proxy: undefined,
      })
    })
  })
})
