import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MovieHeaderV2 } from './MovieHeaderV2'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'
import type { UIMediaFolder } from '@/types/UIMediaFolder'

function renderWithQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
}

vi.mock('./TMDBSearchbox', () => ({
  TMDBSearchbox: vi.fn(() => (
    <div data-testid="tmdb-searchbox">
      <input data-testid="search-input" readOnly />
    </div>
  )),
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

vi.mock('@/hooks/userConfig', () => ({
  useConfig: vi.fn(() => ({
    userConfig: {
      applicationLanguage: 'en',
      primaryDatabase: 'TMDB',
    },
  })),
}))

describe('MovieHeaderV2', () => {
  const defaultProps = {
    onSearchResultSelected: vi.fn(),
    onRenameClick: vi.fn(),
    selectedMediaMetadata: undefined as UIMediaMetadata | undefined,
    selectedMediaFolder: undefined as UIMediaFolder | undefined,
    openScrape: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('"更多" dropdown / "在TMDB中打开"', () => {
    it('disables the more menu button when tmdb id is not available (no tmdbMovie)', () => {
      renderWithQueryClient(
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

    it('disables the more menu button when movie has no usable TMDB id', () => {
      renderWithQueryClient(
        <MovieHeaderV2
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/movie',
              mediaFiles: [],
              movie: { name: 'Movie', id: '', database: 'TMDB' },
            } as UIMediaMetadata
          }
        />
      )
      const moreButton = screen.getByRole('button', { name: 'movie.more' })
      expect(moreButton).toBeDisabled()
    })

    it('enables the more menu button when movie has TMDB id', () => {
      renderWithQueryClient(
        <MovieHeaderV2
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/movie',
              mediaFiles: [],
              movie: { id: '789', name: 'Test Movie', database: 'TMDB' },
            } as UIMediaMetadata
          }
        />
      )
      const moreButton = screen.getByRole('button', { name: 'movie.more' })
      expect(moreButton).not.toBeDisabled()
    })
  })

  describe('folder status driven loading state', () => {
    const okMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/movie',
      mediaFiles: [],
      movie: { id: '789', name: 'Test Movie', database: 'TMDB' },
    } as UIMediaMetadata

    it('shows loading skeleton and hides searchbox when selected folder is updating', () => {
      renderWithQueryClient(
        <MovieHeaderV2
          {...defaultProps}
          selectedMediaMetadata={okMetadata}
          selectedMediaFolder={{ path: '/media/movie', status: 'updating' }}
        />
      )

      expect(screen.queryByPlaceholderText('movie.searchPlaceholder')).not.toBeInTheDocument()
    })

    it('shows searchbox when selected folder status is ok', () => {
      renderWithQueryClient(
        <MovieHeaderV2
          {...defaultProps}
          selectedMediaMetadata={okMetadata}
          selectedMediaFolder={{ path: '/media/movie', status: 'ok' }}
        />
      )

      expect(screen.getByPlaceholderText('movie.searchPlaceholder')).toBeInTheDocument()
    })
  })
})
