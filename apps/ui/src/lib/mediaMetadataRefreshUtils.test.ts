import { describe, it, expect } from 'vitest'
import { mergeRefreshedMetadata } from './mediaMetadataRefreshUtils'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'
import type { MediaMetadata } from '@core/types'

const createMockMediaMetadata = (overrides?: Partial<MediaMetadata>): MediaMetadata => ({
  mediaFolderPath: '/media/show1',
  type: 'tvshow-folder',
  ...overrides,
} as MediaMetadata)

const createMockUIMediaMetadata = (overrides?: Partial<UIMediaMetadata>): UIMediaMetadata => ({
  mediaFolderPath: '/media/show1',
  type: 'tvshow-folder',
  status: 'ok',
  ...overrides,
} as UIMediaMetadata)

describe('mergeRefreshedMetadata', () => {
  it('should return response with idle status when no current metadata exists', () => {
    const response = createMockMediaMetadata({
      mediaFolderPath: '/media/new-show',
      mediaName: 'New Show',
    })
    const currentMetadata = undefined

    const result = mergeRefreshedMetadata(response, currentMetadata)

    expect(result.mediaFolderPath).toBe('/media/new-show')
    expect(result.mediaName).toBe('New Show')
    expect(result.status).toBe('idle')
  })

  it('should preserve status from current metadata', () => {
    const response = createMockMediaMetadata({
      mediaFolderPath: '/media/show1',
      mediaName: 'Updated Name',
    })
    const currentMetadata = createMockUIMediaMetadata({
      mediaFolderPath: '/media/show1',
      status: 'loading',
    })

    const result = mergeRefreshedMetadata(response, currentMetadata)

    expect(result.mediaName).toBe('Updated Name')
    expect(result.status).toBe('loading')
  })

  it('should preserve all UIMediaMetadataProps from current metadata', () => {
    const response = createMockMediaMetadata({
      mediaFolderPath: '/media/show1',
      mediaName: 'Updated Name',
    })
    const currentMetadata = createMockUIMediaMetadata({
      mediaFolderPath: '/media/show1',
      status: 'updating',
    })

    const result = mergeRefreshedMetadata(response, currentMetadata)

    expect(result.status).toBe('updating')
  })

  it('should preserve ok status from current metadata', () => {
    const response = createMockMediaMetadata({
      mediaFolderPath: '/media/show1',
      mediaName: 'Updated Name',
    })
    const currentMetadata = createMockUIMediaMetadata({
      mediaFolderPath: '/media/show1',
      status: 'ok',
    })

    const result = mergeRefreshedMetadata(response, currentMetadata)

    expect(result.status).toBe('ok')
  })

  it('should preserve error status from current metadata', () => {
    const response = createMockMediaMetadata({
      mediaFolderPath: '/media/show1',
      mediaName: 'Updated Name',
    })
    const currentMetadata = createMockUIMediaMetadata({
      mediaFolderPath: '/media/show1',
      status: 'error_loading_metadata',
    })

    const result = mergeRefreshedMetadata(response, currentMetadata)

    expect(result.status).toBe('error_loading_metadata')
  })

  it('should preserve initializing status from current metadata', () => {
    const response = createMockMediaMetadata({
      mediaFolderPath: '/media/show1',
      mediaName: 'Updated Name',
    })
    const currentMetadata = createMockUIMediaMetadata({
      mediaFolderPath: '/media/show1',
      status: 'initializing',
    })

    const result = mergeRefreshedMetadata(response, currentMetadata)

    expect(result.status).toBe('initializing')
  })

  it('should preserve folder_not_found status from current metadata', () => {
    const response = createMockMediaMetadata({
      mediaFolderPath: '/media/show1',
      mediaName: 'Updated Name',
    })
    const currentMetadata = createMockUIMediaMetadata({
      mediaFolderPath: '/media/show1',
      status: 'folder_not_found',
    })

    const result = mergeRefreshedMetadata(response, currentMetadata)

    expect(result.status).toBe('folder_not_found')
  })

  it('should update media metadata fields from response while preserving UI props', () => {
    const response = createMockMediaMetadata({
      mediaFolderPath: '/media/show1',
      mediaName: 'Updated Name',
      officalMediaName: 'Official Name',
      tmdbTVShowId: 12345,
    })
    const currentMetadata = createMockUIMediaMetadata({
      mediaFolderPath: '/media/show1',
      mediaName: 'Old Name',
      status: 'loading',
    })

    const result = mergeRefreshedMetadata(response, currentMetadata)

    expect(result.mediaName).toBe('Updated Name')
    expect(result.officalMediaName).toBe('Official Name')
    expect(result.tmdbTVShowId).toBe(12345)
    expect(result.status).toBe('loading')
  })

  it('should handle empty response metadata', () => {
    const response = {} as MediaMetadata
    const currentMetadata = createMockUIMediaMetadata({
      mediaFolderPath: '/media/show1',
      status: 'ok',
    })

    const result = mergeRefreshedMetadata(response, currentMetadata)

    expect(result.status).toBe('ok')
  })

  it('should merge complex nested objects correctly', () => {
    const response = createMockMediaMetadata({
      mediaFolderPath: '/media/show1',
      tvShow: {
        id: '1',
        name: 'Show 1',
        database: 'TMDB',
        seasons: [
          {
            season: 1,
            name: 'Season 1',
            episodes: [
              { season: 1, episode: 1, name: 'Pilot' },
            ],
          },
        ],
      },
    })
    const currentMetadata = createMockUIMediaMetadata({
      mediaFolderPath: '/media/show1',
      status: 'loading',
    })

    const result = mergeRefreshedMetadata(response, currentMetadata)

    expect(result.tvShow?.name).toBe('Show 1')
    expect(result.tvShow?.seasons).toHaveLength(1)
    expect(result.tvShow?.seasons?.[0]?.episodes).toHaveLength(1)
    expect(result.status).toBe('loading')
  })

  it('should handle array fields correctly', () => {
    const response = createMockMediaMetadata({
      mediaFolderPath: '/media/show1',
      files: ['/media/show1/episode1.mkv', '/media/show1/episode2.mkv'],
    })
    const currentMetadata = createMockUIMediaMetadata({
      mediaFolderPath: '/media/show1',
      status: 'updating',
      files: ['/media/show1/old.mkv'],
    })

    const result = mergeRefreshedMetadata(response, currentMetadata)

    expect(result.files).toEqual(['/media/show1/episode1.mkv', '/media/show1/episode2.mkv'])
    expect(result.status).toBe('updating')
  })
})
