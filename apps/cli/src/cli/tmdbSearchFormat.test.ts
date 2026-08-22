import { describe, expect, it } from 'vitest'
import { formatTmdbSearchResults } from './tmdbSearchFormat'
import type { TmdbSearchResponseBody } from '@smm/core'

describe('formatTmdbSearchResults', () => {
  it('formats tv results as index id name (date) then overview', () => {
    const body: TmdbSearchResponseBody = {
      page: 1,
      total_pages: 1,
      total_results: 2,
      results: [
        {
          id: 42,
          name: 'My Show',
          original_name: 'My Show',
          overview: 'A show about things',
          poster_path: null,
          backdrop_path: null,
          first_air_date: '2020-01-01',
          vote_average: 0,
          vote_count: 0,
          popularity: 0,
          genre_ids: [],
          origin_country: [],
        },
        {
          id: 7,
          name: 'Other',
          original_name: 'Other',
          overview: '',
          poster_path: null,
          backdrop_path: null,
          first_air_date: '2019-05-05',
          vote_average: 0,
          vote_count: 0,
          popularity: 0,
          genre_ids: [],
          origin_country: [],
        },
      ],
    }

    expect(formatTmdbSearchResults(body, 'tv')).toBe(
      ['#1 42 My Show (2020-01-01)', 'A show about things', '#2 7 Other (2019-05-05)', ''].join(
        '\n',
      ),
    )
  })

  it('formats movie results with title and release_date', () => {
    const body: TmdbSearchResponseBody = {
      page: 1,
      total_pages: 1,
      total_results: 1,
      results: [
        {
          id: 99,
          title: 'My Film',
          original_title: 'My Film',
          overview: 'A film',
          poster_path: null,
          backdrop_path: null,
          release_date: '2021-02-03',
          vote_average: 0,
          vote_count: 0,
          popularity: 0,
          genre_ids: [],
          adult: false,
          video: false,
        },
      ],
    }

    expect(formatTmdbSearchResults(body, 'movie')).toBe('#1 99 My Film (2021-02-03)\nA film')
  })
})
