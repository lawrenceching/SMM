import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runCli } from './runCli'

const mockGetTvdbSeriesById = vi.fn()
const mockGetTvdbMovieById = vi.fn()

vi.mock('../core/getCore', () => ({
  getCore: () => ({
    getTvdbSeriesById: mockGetTvdbSeriesById,
    getTvdbMovieById: mockGetTvdbMovieById,
  }),
}))

const sampleSeries = {
  extended: { id: 355969, name: 'Wataten' },
  translation: { name: '天使降临到我身边！' },
}

const sampleMovie = {
  extended: { id: 116, name: 'The Dark Knight' },
  translation: { name: 'The Dark Knight' },
}

describe('smm tvdb tv / movie', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTvdbSeriesById.mockResolvedValue(sampleSeries)
    mockGetTvdbMovieById.mockResolvedValue(sampleMovie)
  })

  it('prints default tree for tv and forwards ISO 639-3 lang + connection options', async () => {
    const logs: string[] = []
    const origLog = console.log
    console.log = (msg: string) => logs.push(msg)
    try {
      const code = await runCli([
        'node',
        'smm',
        'tvdb',
        'tv',
        '355969',
        '--lang',
        'zho',
        '--host',
        'https://tvdb.example/v4',
        '--password',
        'key',
        '--proxy',
        'socks5://127.0.0.1:1',
      ])
      expect(code).toBe(0)
      expect(mockGetTvdbSeriesById).toHaveBeenCalledWith(355969, {
        language: 'zho',
        host: 'https://tvdb.example/v4',
        password: 'key',
        proxy: 'socks5://127.0.0.1:1',
      })
      const out = logs.join('\n')
      expect(out).toContain('extended:')
      expect(out).toContain('translation:')
      expect(out).not.toMatch(/^database:/m)
    } finally {
      console.log = origLog
    }
  })

  it('prints pretty JSON for movie with -f json', async () => {
    const logs: string[] = []
    const origLog = console.log
    console.log = (msg: string) => logs.push(msg)
    try {
      const code = await runCli(['node', 'smm', 'tvdb', 'movie', '116', '-f', 'json'])
      expect(code).toBe(0)
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
      const code = await runCli(['node', 'smm', 'tvdb', 'tv', 'abc'])
      expect(code).toBe(1)
      expect(mockGetTvdbSeriesById).not.toHaveBeenCalled()
      expect(errors.join('\n')).toMatch(/id/i)
    } finally {
      console.error = origError
    }
  })
})
