import { describe, expect, it } from 'vitest'
import { formatTvdbSearchResults } from './tvdbSearchFormat'

const seriesItem = {
  id: 'series-42',
  objectID: 'series-42',
  tvdb_id: '42',
  name: 'My Show',
  overview: 'A show',
  first_air_time: '2020-01-01',
} as never

const movieItem = {
  id: 'movie-7',
  objectID: 'movie-7',
  tvdb_id: '7',
  name: 'My Film',
  overview: 'A film',
  release_date: '2019-05-01',
} as never

describe('formatTvdbSearchResults', () => {
  it('formats series results', () => {
    const text = formatTvdbSearchResults([seriesItem], 'series')
    expect(text).toBe('#1 42 My Show (2020-01-01)\nA show')
  })

  it('formats movie results with release date', () => {
    const text = formatTvdbSearchResults([movieItem], 'movie')
    expect(text).toBe('#1 7 My Film (2019-05-01)\nA film')
  })

  it('returns empty string for empty results', () => {
    expect(formatTvdbSearchResults([], 'series')).toBe('')
  })
})
