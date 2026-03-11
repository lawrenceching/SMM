import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TvShowHeaderV2 } from './TvShowHeaderV2'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'

vi.mock('./TMDBSearchbox', () => ({
  TMDBSearchbox: vi.fn(() => (
    <div data-testid="tmdb-searchbox">
      <input data-testid="search-input" readOnly />
    </div>
  )),
}))

vi.mock('@/lib/i18n', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => key,
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
})
