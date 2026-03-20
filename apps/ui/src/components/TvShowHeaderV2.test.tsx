import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TvShowHeaderV2 } from './TvShowHeaderV2'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'

const mockMediaDatabaseSearchbox = vi.fn((props: any) => (
  <div data-testid="media-database-searchbox" data-value={props.value ?? ''} />
))

vi.mock('./MediaDatabaseSearchbox', () => ({
  MediaDatabaseSearchbox: (props: any) => mockMediaDatabaseSearchbox(props),
}))

vi.mock('@/lib/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/i18n')>()
  return {
    ...actual,
    useTranslation: vi.fn(() => ({
      t: (key: string) => key,
    })),
  }
})

vi.mock('@/providers/config-provider', () => ({
  useConfig: vi.fn(() => ({
    userConfig: {
      applicationLanguage: 'en',
      primaryDatabase: 'TMDB',
    },
  })),
}))

describe('TvShowHeaderV2', () => {
  const defaultProps = {
    onSearchResultSelected: vi.fn(),
    onRecognizeButtonClick: vi.fn(),
    onRenameClick: vi.fn(),
    selectedMediaMetadata: undefined as UIMediaMetadata | undefined,
    openScrape: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('"更多" dropdown / "在TMDB中打开"', () => {
    it('always enables the more menu button so overflow actions are accessible on small screens', () => {
      render(
        <TvShowHeaderV2
          {...defaultProps}
          selectedMediaMetadata={{
            status: 'ok',
            mediaFolderPath: '/media/show',
            mediaFiles: [],
          } as UIMediaMetadata}
        />
      )
      const moreButton = screen.getByRole('button', { name: 'tvShow.more' })
      expect(moreButton).not.toBeDisabled()
    })

    it('enables the more menu button when tmdbTvShow.id is available', () => {
      render(
        <TvShowHeaderV2
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/show',
              mediaFiles: [],
              tmdbTvShow: { id: 123, name: 'Test Show' },
            } as unknown as UIMediaMetadata
          }
        />
      )
      const moreButton = screen.getByRole('button', { name: 'tvShow.more' })
      expect(moreButton).not.toBeDisabled()
    })

    it('enables the more menu button when tmdbMovie.id is available (and no tmdbTvShow)', () => {
      render(
        <TvShowHeaderV2
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/movie',
              mediaFiles: [],
              tmdbMovie: { id: 456, title: 'Test Movie' },
            } as unknown as UIMediaMetadata
          }
        />
      )
      const moreButton = screen.getByRole('button', { name: 'tvShow.more' })
      expect(moreButton).not.toBeDisabled()
    })
  })

  describe('TVDB TV Show Metadata', () => {
    it('passes tvdbTvShow.name as value when tmdbTvShow is undefined', () => {
      render(
        <TvShowHeaderV2
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/show',
              mediaFiles: [],
              tmdbTvShow: undefined,
              tvdbTvShow: { id: 'tvdb-1', name: 'TVDB Show Name' },
            } as unknown as UIMediaMetadata
          }
        />
      )

      expect(mockMediaDatabaseSearchbox).toHaveBeenCalled()
      const firstCallProps = mockMediaDatabaseSearchbox.mock.calls[0]?.[0]
      expect(firstCallProps?.value).toBe('TVDB Show Name')
    })
  })
})
