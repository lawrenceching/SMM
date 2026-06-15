import { describe, it, expect } from 'vitest'
import type { MediaMetadata } from '../types'
import {
  buildGetEpisodesResponse,
  createEmptyGetEpisodesData,
} from './buildGetEpisodesResponse'

describe('buildGetEpisodesResponse', () => {
  it('returns empty data when metadata has no tvShow', () => {
    const metadata: MediaMetadata = {
      mediaFolderPath: '/media/show',
      type: 'tvshow-folder',
    }
    expect(buildGetEpisodesResponse(metadata)).toEqual(
      createEmptyGetEpisodesData(),
    )
  })

  it('maps seasons, episodes, and recognized video paths', () => {
    const metadata: MediaMetadata = {
      mediaFolderPath: '/media/show',
      type: 'tvshow-folder',
      tvShow: {
        id: '123',
        name: 'Demo Show',
        database: 'TMDB',
        seasons: [
          {
            season: 1,
            name: 'Season 1',
            episodes: [
              { season: 1, episode: 1, name: 'Pilot' },
              { season: 1, episode: 2, name: 'Episode 2' },
            ],
          },
        ],
      },
      mediaFiles: [
        {
          absolutePath: '/media/show/S01E01.mkv',
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
    }

    const result = buildGetEpisodesResponse(metadata)
    expect(result.showName).toBe('Demo Show')
    expect(result.numberOfSeasons).toBe(1)
    expect(result.totalCount).toBe(2)
    expect(result.episodes[0]?.videoFilePath).toBeTruthy()
    expect(result.episodes[1]?.videoFilePath).toBeUndefined()
  })

  it('createEmptyGetEpisodesData returns zeroed fields', () => {
    expect(createEmptyGetEpisodesData()).toEqual({
      episodes: [],
      totalCount: 0,
      showName: '',
      numberOfSeasons: 0,
    })
  })
})
