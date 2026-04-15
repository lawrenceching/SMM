import { describe, it, expect } from 'vitest'
import {
  hasDomainMetadataChanged,
  extractPersistableMediaMetadata,
  toUIMediaMetadata,
  mergeUIMetadata,
} from './uiDomainMapper'
import type { MediaMetadata, TvShowMediaMetadata } from '@core/types'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'

const baseTvShow = (): TvShowMediaMetadata => ({
  id: '1',
  name: 'Show 1',
  database: 'TMDB',
  seasons: [],
})

const createMockMediaMetadata = (overrides?: Partial<MediaMetadata>): MediaMetadata => ({
  mediaFolderPath: '/media/show1',
  type: 'tvshow-folder',
  tvShow: baseTvShow(),
  files: ['/media/show1/episode1.mp4'],
  mediaFiles: [],
  ...overrides,
})

const createMockUIMediaMetadata = (overrides?: Partial<UIMediaMetadata>): UIMediaMetadata => ({
  ...createMockMediaMetadata(overrides),
  status: 'idle',
} as UIMediaMetadata)

describe('UiDomainMapper', () => {
  describe('hasDomainMetadataChanged', () => {
    it('should return true when current metadata is undefined', () => {
      const updated = createMockUIMediaMetadata()
      const result = hasDomainMetadataChanged(undefined, updated)
      expect(result).toBe(true)
    })

    it('should return false when only UI properties changed', () => {
      const tv = baseTvShow()
      const current = createMockUIMediaMetadata({ status: 'idle', tvShow: tv })
      const updated = createMockUIMediaMetadata({ status: 'loading', tvShow: tv })
      const result = hasDomainMetadataChanged(current, updated)
      expect(result).toBe(false)
    })

    it('should return true when domain properties changed', () => {
      const current = createMockUIMediaMetadata({
        tvShow: { ...baseTvShow(), name: 'Show 1' },
      })
      const updated = createMockUIMediaMetadata({
        tvShow: { ...baseTvShow(), name: 'Show 2' },
      })
      const result = hasDomainMetadataChanged(current, updated)
      expect(result).toBe(true)
    })

    it('should handle array changes', () => {
      const current = createMockUIMediaMetadata({
        mediaFiles: [{ seasonNumber: 1, episodeNumber: 1, absolutePath: '/media/show1/ep1.mp4' }],
      })
      const updated = createMockUIMediaMetadata({
        mediaFiles: [{ seasonNumber: 1, episodeNumber: 2, absolutePath: '/media/show1/ep1.mp4' }],
      })
      const result = hasDomainMetadataChanged(current, updated)
      expect(result).toBe(true)
    })
  })

  describe('extractPersistableMediaMetadata', () => {
    it('should extract domain metadata by removing UI-only properties', () => {
      const tvShow: TvShowMediaMetadata = {
        id: '123',
        name: 'Show 1',
        database: 'TMDB',
        seasons: [],
      }
      const uiMetadata = createMockUIMediaMetadata({
        status: 'loading',
        tvShow,
      })

      const result = extractPersistableMediaMetadata(uiMetadata)

      expect(result).toEqual({
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder',
        files: ['/media/show1/episode1.mp4'],
        mediaFiles: [],
        tvShow,
      })
      expect(result).not.toHaveProperty('status')
    })
  })

  describe('toUIMediaMetadata', () => {
    it('should convert domain metadata to UI metadata with default status', () => {
      const domainMetadata = createMockMediaMetadata()
      const result = toUIMediaMetadata(domainMetadata)

      expect(result).toEqual({
        ...domainMetadata,
        status: 'idle',
      })
    })

    it('should allow overriding UI properties', () => {
      const domainMetadata = createMockMediaMetadata()
      const result = toUIMediaMetadata(domainMetadata, { status: 'loading' })

      expect(result.status).toBe('loading')
    })
  })

  describe('mergeUIMetadata', () => {
    it('should merge updates into existing UI metadata', () => {
      const base = createMockUIMediaMetadata({ status: 'idle' })
      const updates = {
        status: 'loading' as const,
        tvShow: { ...baseTvShow(), name: 'Updated Show' },
      }

      const result = mergeUIMetadata(base, updates)

      expect(result.mediaFolderPath).toBe('/media/show1') // preserved
      expect(result.type).toBe('tvshow-folder') // preserved
      expect(result.status).toBe('loading') // updated
      expect(result.tvShow?.name).toBe('Updated Show') // updated
    })

    it('should not mutate the original metadata', () => {
      const base = createMockUIMediaMetadata({ status: 'idle' })
      const originalStatus = base.status

      mergeUIMetadata(base, { status: 'loading' })

      expect(base.status).toBe(originalStatus)
    })
  })
})
