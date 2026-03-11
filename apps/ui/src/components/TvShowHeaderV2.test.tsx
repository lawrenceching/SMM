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
    it('disables the more menu button when tmdb id is not available (no tmdbTvShow and no tmdbMovie)', () => {
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
      expect(moreButton).toBeDisabled()
    })

    it('disables the more menu button when tmdbTvShow exists but has no id', () => {
      render(
        <TvShowHeaderV2
          {...defaultProps}
          selectedMediaMetadata={{
            status: 'ok',
            mediaFolderPath: '/media/show',
            mediaFiles: [],
            tmdbTvShow: { name: 'Show', id: undefined as unknown as number },
          } as UIMediaMetadata}
        />
      )
      const moreButton = screen.getByRole('button', { name: 'tvShow.more' })
      expect(moreButton).toBeDisabled()
    })

    it('enables the more menu button when tmdbTvShow.id is available', () => {
      render(
        <TvShowHeaderV2
          {...defaultProps}
          selectedMediaMetadata={{
            status: 'ok',
            mediaFolderPath: '/media/show',
            mediaFiles: [],
            tmdbTvShow: { id: 123, name: 'Test Show' },
          } as UIMediaMetadata}
        />
      )
      const moreButton = screen.getByRole('button', { name: 'tvShow.more' })
      expect(moreButton).not.toBeDisabled()
    })

    it('enables the more menu button when tmdbMovie.id is available (and no tmdbTvShow)', () => {
      render(
        <TvShowHeaderV2
          {...defaultProps}
          selectedMediaMetadata={{
            status: 'ok',
            mediaFolderPath: '/media/movie',
            mediaFiles: [],
            tmdbMovie: { id: 456, title: 'Test Movie' },
          } as UIMediaMetadata}
        />
      )
      const moreButton = screen.getByRole('button', { name: 'tvShow.more' })
      expect(moreButton).not.toBeDisabled()
    })
  })
})
