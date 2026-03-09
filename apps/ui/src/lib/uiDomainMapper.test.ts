import { describe, it, expect } from 'vitest'
import {
  hasDomainMetadataChanged,
  extractPersistableMediaMetadata,
  toUIMediaMetadata,
  mergeUIMetadata,
} from './uiDomainMapper'
import type { MediaMetadata } from '@core/types'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'

const createMockMediaMetadata = (overrides?: Partial<MediaMetadata>): MediaMetadata => ({
  mediaFolderPath: '/media/show1',
  type: 'tvshow-folder',
  mediaName: 'Show 1',
  files: ['/media/show1/episode1.mp4'],
  mediaFiles: [],
  ...overrides,
} as MediaMetadata)

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
      const current = createMockUIMediaMetadata({ status: 'idle', mediaName: 'Show 1' })
      const updated = createMockUIMediaMetadata({ status: 'loading', mediaName: 'Show 1' })
      const result = hasDomainMetadataChanged(current, updated)
      expect(result).toBe(false)
    })

    it('should return true when domain properties changed', () => {
      const current = createMockUIMediaMetadata({ mediaName: 'Show 1' })
      const updated = createMockUIMediaMetadata({ mediaName: 'Show 2' })
      const result = hasDomainMetadataChanged(current, updated)
      expect(result).toBe(true)
    })

    it('should handle array changes', () => {
      const current = createMockUIMediaMetadata({
        mediaFiles: [{ seasonNumber: 1, episodeNumber: 1, path: '/media/show1/ep1.mp4' } as any]
      })
      const updated = createMockUIMediaMetadata({
        mediaFiles: [{ seasonNumber: 1, episodeNumber: 2, path: '/media/show1/ep1.mp4' } as any]
      })
      const result = hasDomainMetadataChanged(current, updated)
      expect(result).toBe(true)
    })
  })

  describe('extractPersistableMediaMetadata', () => {
    it('should extract domain metadata by removing UI-only properties', () => {
      const uiMetadata = createMockUIMediaMetadata({
        status: 'loading',
        mediaName: 'Show 1',
        tmdbTvShow: { id: 123, name: 'Show 1' } as any,
      })

      const result = extractPersistableMediaMetadata(uiMetadata)

      expect(result).toEqual({
        mediaFolderPath: '/media/show1',
        type: 'tvshow-folder',
        mediaName: 'Show 1',
        files: ['/media/show1/episode1.mp4'],
        mediaFiles: [],
        tmdbTvShow: { id: 123, name: 'Show 1' },
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
      const base = createMockUIMediaMetadata({ status: 'idle', mediaName: 'Show 1' })
      const updates = { status: 'loading' as const, mediaName: 'Updated Show' }

      const result = mergeUIMetadata(base, updates)

      expect(result.mediaFolderPath).toBe('/media/show1') // preserved
      expect(result.type).toBe('tvshow-folder') // preserved
      expect(result.status).toBe('loading') // updated
      expect(result.mediaName).toBe('Updated Show') // updated
    })

    it('should not mutate the original metadata', () => {
      const base = createMockUIMediaMetadata({ status: 'idle' })
      const originalStatus = base.status

      mergeUIMetadata(base, { status: 'loading' })

      expect(base.status).toBe(originalStatus)
    })
  })
})