import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pattern4, recognizeEpisodes } from './recognizeEpisodes'
import type { MediaMetadata } from '@core/types'

describe('pattern4', () => {
  it('returns empty array when there are multiple seasons', () => {
    const episodes = [
      { season: 1, episode: 1 },
      { season: 2, episode: 1 },
    ]
    const videoFiles = ['Show - 1.mp4', 'Show - 1.mp4']
    expect(pattern4(episodes, videoFiles)).toEqual([])
  })

  it('matches basename ending with hyphen and episode number', () => {
    const episodes = [{ season: 1, episode: 1 }]
    const videoFiles = ['Show Name - 1.mp4']
    expect(pattern4(episodes, videoFiles)).toEqual([
      { season: 1, episode: 1, file: 'Show Name - 1.mp4' },
    ])
  })

  it('matches basename ending with dot divider', () => {
    const episodes = [{ season: 1, episode: 2 }]
    const videoFiles = ['Show.Name.2.mkv']
    expect(pattern4(episodes, videoFiles)).toEqual([
      { season: 1, episode: 2, file: 'Show.Name.2.mkv' },
    ])
  })

  it('matches basename ending with underscore divider', () => {
    const episodes = [{ season: 1, episode: 3 }]
    const videoFiles = ['Show_Name_3.avi']
    expect(pattern4(episodes, videoFiles)).toEqual([
      { season: 1, episode: 3, file: 'Show_Name_3.avi' },
    ])
  })

  it('matches basename ending with space before episode number', () => {
    const episodes = [{ season: 1, episode: 4 }]
    const videoFiles = ['Show Name 4.mp4']
    expect(pattern4(episodes, videoFiles)).toEqual([
      { season: 1, episode: 4, file: 'Show Name 4.mp4' },
    ])
  })

  it('matches multiple episodes in single season', () => {
    const episodes = [
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
      { season: 1, episode: 3 },
    ]
    const videoFiles = ['Show - 1.mp4', 'Show.2.mkv', 'Show_3.avi']
    expect(pattern4(episodes, videoFiles)).toEqual([
      { season: 1, episode: 1, file: 'Show - 1.mp4' },
      { season: 1, episode: 2, file: 'Show.2.mkv' },
      { season: 1, episode: 3, file: 'Show_3.avi' },
    ])
  })

  it('uses basename so path prefix is ignored', () => {
    const episodes = [{ season: 1, episode: 1 }]
    const videoFiles = ['/media/library/Show - 1.mp4']
    expect(pattern4(episodes, videoFiles)).toEqual([
      { season: 1, episode: 1, file: '/media/library/Show - 1.mp4' },
    ])
  })

  it('is case-insensitive for extension', () => {
    const episodes = [{ season: 1, episode: 1 }]
    const videoFiles = ['Show - 1.MP4']
    expect(pattern4(episodes, videoFiles)).toEqual([
      { season: 1, episode: 1, file: 'Show - 1.MP4' },
    ])
  })

  it('omits episode when no file matches', () => {
    const episodes = [
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
    ]
    const videoFiles = ['Show - 1.mp4']
    expect(pattern4(episodes, videoFiles)).toEqual([
      { season: 1, episode: 1, file: 'Show - 1.mp4' },
    ])
  })

  it('returns empty when no file matches any episode', () => {
    const episodes = [{ season: 1, episode: 1 }]
    const videoFiles = ['Show - 2.mp4', 'Other.mkv']
    expect(pattern4(episodes, videoFiles)).toEqual([])
  })

  it('returns first matching file when multiple files match same episode', () => {
    const episodes = [{ season: 1, episode: 1 }]
    const videoFiles = ['Show - 1.mp4', 'Other - 1.avi']
    const result = pattern4(episodes, videoFiles)
    expect(result).toHaveLength(1)
    expect(result[0].episode).toBe(1)
    expect(result[0].file).toBe('Show - 1.mp4')
  })
})

/** Minimal MediaMetadata for recognizeEpisodes tests */
function makeMM(overrides: Partial<MediaMetadata> = {}): MediaMetadata {
  return {
    mediaFolderPath: '/media/Show',
    files: [],
    tmdbTvShow: {
      id: 1,
      name: 'Show',
      original_name: 'Show',
      overview: '',
      poster_path: null,
      backdrop_path: null,
      first_air_date: '2020-01-01',
      vote_average: 0,
      vote_count: 0,
      popularity: 0,
      genre_ids: [],
      origin_country: [],
      number_of_seasons: 1,
      number_of_episodes: 3,
      seasons: [
        {
          id: 1,
          name: 'Season 1',
          overview: '',
          poster_path: null,
          season_number: 1,
          air_date: '2020-01-01',
          episode_count: 3,
          episodes: [
            { id: 1, name: 'Ep1', overview: '', still_path: null, air_date: '', episode_number: 1, season_number: 1, vote_average: 0, vote_count: 0, runtime: 0 },
            { id: 2, name: 'Ep2', overview: '', still_path: null, air_date: '', episode_number: 2, season_number: 1, vote_average: 0, vote_count: 0, runtime: 0 },
            { id: 3, name: 'Ep3', overview: '', still_path: null, air_date: '', episode_number: 3, season_number: 1, vote_average: 0, vote_count: 0, runtime: 0 },
          ],
        },
      ],
      status: '',
      type: '',
      in_production: false,
      last_air_date: '',
      networks: [],
      production_companies: [],
    },
    ...overrides,
  } as MediaMetadata
}

describe('recognizeEpisodes', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty array when files is undefined', () => {
    const mm = makeMM({ files: undefined })
    expect(recognizeEpisodes(mm)).toEqual([])
  })

  it('returns empty array when files is null', () => {
    const mm = makeMM({ files: null })
    expect(recognizeEpisodes(mm)).toEqual([])
  })

  it('returns empty array when files is empty', () => {
    const mm = makeMM({ files: [] })
    expect(recognizeEpisodes(mm)).toEqual([])
  })

  it('returns empty array when tmdbTvShow is undefined', () => {
    const mm = makeMM({ files: ['Show - 1.mp4'], tmdbTvShow: undefined })
    expect(recognizeEpisodes(mm)).toEqual([])
  })

  it('returns empty array when tmdbTvShow.seasons is empty', () => {
    const mm = makeMM({ files: ['Show - 1.mp4'] })
    if (mm.tmdbTvShow) mm.tmdbTvShow.seasons = []
    expect(recognizeEpisodes(mm)).toEqual([])
  })

  it('returns empty array when first season has no episodes', () => {
    const mm = makeMM({ files: ['Show - 1.mp4'] })
    if (mm.tmdbTvShow?.seasons?.[0]) mm.tmdbTvShow.seasons[0].episodes = []
    expect(recognizeEpisodes(mm)).toEqual([])
  })

  it('returns empty array when no video files (only non-video extensions)', () => {
    const mm = makeMM({ files: ['Show - 1.txt', 'Readme.srt', 'poster.jpg'] })
    expect(recognizeEpisodes(mm)).toEqual([])
  })

  it('excludes files under /Extras/ and /Subtitles/', () => {
    const mm = makeMM({
      files: [
        '/media/Show/Extras/Behind the Scenes.mp4',
        '/media/Show/Subtitles/Show - 1.srt',
        '/media/Show/Show - 1.mp4',
      ],
    })
    const result = recognizeEpisodes(mm)
    expect(result).toHaveLength(1)
    expect(result[0].file).toBe('/media/Show/Show - 1.mp4')
  })

  it('recognizes by pattern1 (S01E01) when video files match', () => {
    const mm = makeMM({
      files: ['/media/Show/Show.S01E01.1080p.mp4', '/media/Show/Show.S01E02.mkv', '/media/Show/Show.S01E03.avi'],
    })
    const result = recognizeEpisodes(mm)
    expect(result).toEqual([
      { season: 1, episode: 1, file: '/media/Show/Show.S01E01.1080p.mp4' },
      { season: 1, episode: 2, file: '/media/Show/Show.S01E02.mkv' },
      { season: 1, episode: 3, file: '/media/Show/Show.S01E03.avi' },
    ])
  })

  it('recognizes by pattern2 (第X季第Y集) when video files match', () => {
    const mm = makeMM({
      files: ['/media/Show/Show 第1季第1集.mp4', '/media/Show/Show 第1季第2集.mkv', '/media/Show/Show 第1季第3集.avi'],
    })
    const result = recognizeEpisodes(mm)
    expect(result).toEqual([
      { season: 1, episode: 1, file: '/media/Show/Show 第1季第1集.mp4' },
      { season: 1, episode: 2, file: '/media/Show/Show 第1季第2集.mkv' },
      { season: 1, episode: 3, file: '/media/Show/Show 第1季第3集.avi' },
    ])
  })

  it('recognizes by pattern3 (第XX季第YY集) when video files match', () => {
    const mm = makeMM({
      files: ['/media/Show/Show 第01季第01集.mp4', '/media/Show/Show 第01季第02集.mkv', '/media/Show/Show 第01季第03集.avi'],
    })
    const result = recognizeEpisodes(mm)
    expect(result).toEqual([
      { season: 1, episode: 1, file: '/media/Show/Show 第01季第01集.mp4' },
      { season: 1, episode: 2, file: '/media/Show/Show 第01季第02集.mkv' },
      { season: 1, episode: 3, file: '/media/Show/Show 第01季第03集.avi' },
    ])
  })

  it('recognizes by pattern4 (single season, xxx<divider>N.ext) when video files match', () => {
    const mm = makeMM({
      files: ['/media/Show/Show - 1.mp4', '/media/Show/Show.2.mkv', '/media/Show/Show_3.avi'],
    })
    const result = recognizeEpisodes(mm)
    expect(result).toEqual([
      { season: 1, episode: 1, file: '/media/Show/Show - 1.mp4' },
      { season: 1, episode: 2, file: '/media/Show/Show.2.mkv' },
      { season: 1, episode: 3, file: '/media/Show/Show_3.avi' },
    ])
  })

  it('returns empty array when no pattern matches', () => {
    const mm = makeMM({
      files: ['/media/Show/UnknownFormat_x_y_z.mp4', '/media/Show/Other.mkv'],
    })
    expect(recognizeEpisodes(mm)).toEqual([])
  })

  it('prefers pattern1 over pattern4 when both could match', () => {
    const mm = makeMM({
      files: ['/media/Show/Show.S01E01.mp4', '/media/Show/Show - 1.mp4'],
    })
    const result = recognizeEpisodes(mm)
    expect(result).toHaveLength(1)
    expect(result[0].file).toContain('S01E01')
  })
})
