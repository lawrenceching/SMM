import { describe, it, expect } from 'vitest'
import type { MediaMetadata } from '../types'
import {
  createBaseGetMediaMetadataData,
  fillMediaMetadataResponseData,
} from './getMediaMetadataResponse'
import { GET_MEDIA_METADATA_UNRECOGNIZED } from '../types/ai-tools/getMediaMetadata'

describe('fillMediaMetadataResponseData', () => {
  it('marks tvshow without tvShow as unrecognized', () => {
    const metadata: MediaMetadata = {
      mediaFolderPath: '/media/show',
      type: 'tvshow-folder',
    }
    const result = fillMediaMetadataResponseData(metadata, '/media/show')
    expect(result.tvShow).toBe(GET_MEDIA_METADATA_UNRECOGNIZED)
  })

  it('maps tv show seasons and episodes', () => {
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
            episodes: [{ season: 1, episode: 1, name: 'Pilot' }],
          },
        ],
      },
    }
    const result = fillMediaMetadataResponseData(metadata, '/media/show')
    expect(result.tvShow).toMatchObject({
      source: 'TMDB',
      id: 123,
      name: 'Demo Show',
    })
  })

  it('createBaseGetMediaMetadataData normalizes path', () => {
    const base = createBaseGetMediaMetadataData('/media/show')
    expect(base.type).toBe('tvshow-folder')
    expect(base.mediaFolderPath).toBeTruthy()
  })
})
