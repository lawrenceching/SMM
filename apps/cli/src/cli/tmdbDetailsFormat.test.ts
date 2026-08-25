import { describe, expect, it } from 'vitest'
import { formatTmdbDetailsTree } from './tmdbDetailsFormat'

describe('formatTmdbDetailsTree', () => {
  it('formats primitives, null, nested objects, and arrays', () => {
    const text = formatTmdbDetailsTree({
      id: 83095,
      name: 'Wataten',
      overview: null,
      missing: undefined,
      genres: [{ id: 16, name: 'Animation' }],
      episode_run_time: [24],
    })
    expect(text).toBe(
      [
        'id: 83095',
        'name: Wataten',
        'overview: null',
        'genres:',
        '  [0]:',
        '    id: 16',
        '    name: Animation',
        'episode_run_time:',
        '  [0]: 24',
      ].join('\n'),
    )
  })

  it('formats a bare non-object as a single line', () => {
    expect(formatTmdbDetailsTree(42)).toBe('42')
    expect(formatTmdbDetailsTree(null)).toBe('null')
  })
})
