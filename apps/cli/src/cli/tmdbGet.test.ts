import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runCli } from './runCli'

const mockGetTvShowInTmdb = vi.fn()
const mockGetMovieInTmdb = vi.fn()

vi.mock('../core/getCore', () => ({
  getCore: () => ({
    getTvShowInTmdb: mockGetTvShowInTmdb,
    getMovieInTmdb: mockGetMovieInTmdb,
  }),
}))

const sampleTv = {
  id: 83095,
  name: 'Wataten',
  genres: [{ id: 16, name: 'Animation' }],
}

const sampleMovie = {
  id: 550,
  title: 'Fight Club',
  genres: [{ id: 18, name: 'Drama' }],
}

describe('smm tmdb tv / movie', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTvShowInTmdb.mockResolvedValue(sampleTv)
    mockGetMovieInTmdb.mockResolvedValue(sampleMovie)
  })

  it('prints default tree for tv and forwards options', async () => {
    const logs: string[] = []
    const origLog = console.log
    console.log = (msg: string) => logs.push(msg)
    try {
      const code = await runCli([
        'node',
        'smm',
        'tmdb',
        'tv',
        '83095',
        '--lang',
        'zh-CN',
        '--host',
        'https://example.test/3',
        '--password',
        'key',
        '--proxy',
        'socks5://127.0.0.1:1',
      ])
      expect(code).toBe(0)
      expect(mockGetTvShowInTmdb).toHaveBeenCalledWith(83095, {
        language: 'zh-CN',
        host: 'https://example.test/3',
        password: 'key',
        proxy: 'socks5://127.0.0.1:1',
      })
      expect(logs.join('\n')).toContain('id: 83095')
      expect(logs.join('\n')).toContain('name: Wataten')
      expect(logs.join('\n')).toContain('genres:')
    } finally {
      console.log = origLog
    }
  })

  it('prints pretty JSON for movie with -f json', async () => {
    const logs: string[] = []
    const origLog = console.log
    console.log = (msg: string) => logs.push(msg)
    try {
      const code = await runCli(['node', 'smm', 'tmdb', 'movie', '550', '-f', 'json'])
      expect(code).toBe(0)
      expect(mockGetMovieInTmdb).toHaveBeenCalledWith(550, {
        language: undefined,
        host: undefined,
        password: undefined,
        proxy: undefined,
      })
      expect(JSON.parse(logs[0]!)).toEqual(sampleMovie)
    } finally {
      console.log = origLog
    }
  })

  it('rejects invalid id without calling Core', async () => {
    const errors: string[] = []
    const origError = console.error
    console.error = (msg: string) => errors.push(msg)
    try {
      const code = await runCli(['node', 'smm', 'tmdb', 'tv', 'abc'])
      expect(code).toBe(1)
      expect(mockGetTvShowInTmdb).not.toHaveBeenCalled()
      expect(errors.join('\n')).toMatch(/id/i)
    } finally {
      console.error = origError
    }
  })
})
