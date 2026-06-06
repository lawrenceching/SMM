import { describe, expect, it } from 'vitest'
import { isRuleBasedRecognizePlanComplete, isRuleBasedRecognizePlanFullyUnchanged } from './isRuleBasedRecognizePlanComplete'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'

const tvShowTwoEpisodes = {
  id: '1',
  name: 'Show',
  database: 'TMDB' as const,
  seasons: [
    {
      season: 1,
      name: '',
      episodes: [
        { season: 1, episode: 1, name: 'E1' },
        { season: 1, episode: 2, name: 'E2' },
      ],
    },
  ],
}

function mediaMetadata(overrides: Partial<UIMediaMetadata> = {}): UIMediaMetadata {
  return {
    status: 'ok',
    mediaFolderPath: '/media/show',
    files: ['/media/show/S01E01.mkv'],
    tvShow: tvShowTwoEpisodes,
    ...overrides,
  }
}

describe('isRuleBasedRecognizePlanComplete', () => {
  it('returns true when all episodes are in plan files', () => {
    const mm = mediaMetadata()
    const files = [
      { season: 1, episode: 1, path: '/media/show/S01E01.mkv' },
      { season: 1, episode: 2, path: '/media/show/S01E02.mkv' },
    ]
    expect(isRuleBasedRecognizePlanComplete(files, mm)).toBe(true)
  })

  it('returns false when only some episodes are in plan files and not in mediaFiles', () => {
    const mm = mediaMetadata()
    const files = [{ season: 1, episode: 1, path: '/media/show/S01E01.mkv' }]
    expect(isRuleBasedRecognizePlanComplete(files, mm)).toBe(false)
  })

  it('returns true when missing plan entry is already in mediaFiles', () => {
    const mm = mediaMetadata({
      mediaFiles: [
        { seasonNumber: 1, episodeNumber: 2, absolutePath: '/media/show/S01E02.mkv' },
      ],
    })
    const files = [{ season: 1, episode: 1, path: '/media/show/S01E01.mkv' }]
    expect(isRuleBasedRecognizePlanComplete(files, mm)).toBe(true)
  })

  it('returns false when plan files is empty and episodes are not in mediaFiles', () => {
    const mm = mediaMetadata()
    expect(isRuleBasedRecognizePlanComplete([], mm)).toBe(false)
  })

  it('returns true when plan files is empty but all episodes are in mediaFiles', () => {
    const mm = mediaMetadata({
      mediaFiles: [
        { seasonNumber: 1, episodeNumber: 1, absolutePath: '/media/show/S01E01.mkv' },
        { seasonNumber: 1, episodeNumber: 2, absolutePath: '/media/show/S01E02.mkv' },
      ],
    })
    expect(isRuleBasedRecognizePlanComplete([], mm)).toBe(true)
  })

  it('returns false when tvShow has no seasons', () => {
    const mm = mediaMetadata({ tvShow: { ...tvShowTwoEpisodes, seasons: [] } })
    const files = [{ season: 1, episode: 1, path: '/media/show/S01E01.mkv' }]
    expect(isRuleBasedRecognizePlanComplete(files, mm)).toBe(false)
  })

  it('returns false when tvShow is missing', () => {
    const mm = mediaMetadata({ tvShow: undefined })
    const files = [{ season: 1, episode: 1, path: '/media/show/S01E01.mkv' }]
    expect(isRuleBasedRecognizePlanComplete(files, mm)).toBe(false)
  })
})

describe('isRuleBasedRecognizePlanFullyUnchanged', () => {
  it('returns true when every plan file matches mediaFiles', () => {
    const mm = mediaMetadata({
      mediaFiles: [
        { seasonNumber: 1, episodeNumber: 1, absolutePath: '/media/show/S01E01.mkv' },
        { seasonNumber: 1, episodeNumber: 2, absolutePath: '/media/show/S01E02.mkv' },
      ],
    })
    const files = [
      { season: 1, episode: 1, path: '/media/show/S01E01.mkv' },
      { season: 1, episode: 2, path: '/media/show/S01E02.mkv' },
    ]
    expect(isRuleBasedRecognizePlanFullyUnchanged(files, mm)).toBe(true)
  })

  it('returns false when a plan file differs from mediaFiles', () => {
    const mm = mediaMetadata({
      mediaFiles: [
        { seasonNumber: 1, episodeNumber: 1, absolutePath: '/media/show/old.mkv' },
      ],
    })
    const files = [{ season: 1, episode: 1, path: '/media/show/S01E01.mkv' }]
    expect(isRuleBasedRecognizePlanFullyUnchanged(files, mm)).toBe(false)
  })

  it('returns false when plan file has no existing mediaFiles mapping', () => {
    const mm = mediaMetadata()
    const files = [{ season: 1, episode: 1, path: '/media/show/S01E01.mkv' }]
    expect(isRuleBasedRecognizePlanFullyUnchanged(files, mm)).toBe(false)
  })

  it('returns false when plan files is empty', () => {
    const mm = mediaMetadata({
      mediaFiles: [
        { seasonNumber: 1, episodeNumber: 1, absolutePath: '/media/show/S01E01.mkv' },
      ],
    })
    expect(isRuleBasedRecognizePlanFullyUnchanged([], mm)).toBe(false)
  })
})
