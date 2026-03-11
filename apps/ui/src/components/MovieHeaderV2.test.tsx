import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MovieHeaderV2 } from './MovieHeaderV2'
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

describe('MovieHeaderV2', () => {
  const defaultProps = {
    onSearchResultSelected: vi.fn(),
    onRenameClick: vi.fn(),
    selectedMediaMetadata: undefined as UIMediaMetadata | undefined,
    openScrape: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('"更多" dropdown / "在TMDB中打开"', () => {
    it('disables the more menu button when tmdb id is not available (no tmdbMovie)', () => {
      render(
        <MovieHeaderV2
          {...defaultProps}
          selectedMediaMetadata={{
            status: 'ok',
            mediaFolderPath: '/media/movie',
            mediaFiles: [],
          } as UIMediaMetadata}
        />
      )
      const moreButton = screen.getByRole('button', { name: 'movie.more' })
      expect(moreButton).toBeDisabled()
    })

    it('disables the more menu button when tmdbMovie exists but has no id', () => {
      render(
        <MovieHeaderV2
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/movie',
              mediaFiles: [],
              tmdbMovie: { title: 'Movie', id: undefined as unknown as number },
            } as unknown as UIMediaMetadata
          }
        />
      )
      const moreButton = screen.getByRole('button', { name: 'movie.more' })
      expect(moreButton).toBeDisabled()
    })

    it('enables the more menu button when tmdbMovie.id is available', () => {
      render(
        <MovieHeaderV2
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/movie',
              mediaFiles: [],
              tmdbMovie: { id: 789, title: 'Test Movie' },
            } as unknown as UIMediaMetadata
          }
        />
      )
      const moreButton = screen.getByRole('button', { name: 'movie.more' })
      expect(moreButton).not.toBeDisabled()
    })
  })
})
