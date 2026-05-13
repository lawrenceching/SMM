import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

vi.mock('@/components/ui/dropdown-menu', () => {
  const React = require('react')
  return {
    DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
    DropdownMenuTrigger: ({ children, asChild }: any) => <div data-testid="dropdown-trigger">{children}</div>,
    DropdownMenuContent: ({ children }: any) => <div role="menu">{children}</div>,
    DropdownMenuItem: ({ children, disabled, onClick, ...rest }: any) => (
      <div role="menuitem" aria-disabled={disabled || undefined} onClick={onClick} {...rest}>{children}</div>
    ),
    DropdownMenuSeparator: () => <hr />,
  }
})

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

const defaultOkFolder: UIMediaFolder = { path: '/media/movie', status: 'ok' }

describe('MovieHeaderV2', () => {
  const defaultProps = {
    onSearchResultSelected: vi.fn(),
    onRenameClick: vi.fn(),
    selectedMediaMetadata: undefined as UIMediaMetadata | undefined,
    selectedMediaFolder: defaultOkFolder as UIMediaFolder | undefined,
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

    it('disables the more menu button when movie has no usable id', () => {
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

    it('enables the more menu button when movie has TVDB id', () => {
      renderWithQueryClient(
        <MovieHeaderV2
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/movie',
              mediaFiles: [],
              movie: { id: 'tvdb-1', name: 'TVDB Movie', database: 'TVDB' },
            } as UIMediaMetadata
          }
        />
      )
      const moreButton = screen.getByRole('button', { name: 'movie.more' })
      expect(moreButton).not.toBeDisabled()
    })
  })

  describe('external link (TMDB / TVDB)', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    afterEach(() => {
      openSpy.mockClear()
    })

    it('shows "Open in TMDB" when database is TMDB', () => {
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

      expect(screen.getByText('movie.openInTmdb')).toBeInTheDocument()
      expect(screen.queryByText('movie.openInTvdb')).not.toBeInTheDocument()
    })

    it('shows "Open in TVDB" when database is TVDB', () => {
      renderWithQueryClient(
        <MovieHeaderV2
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/movie',
              mediaFiles: [],
              movie: { id: 'tvdb-1', name: 'TVDB Movie Name', database: 'TVDB' },
            } as UIMediaMetadata
          }
        />
      )

      expect(screen.getByText('movie.openInTvdb')).toBeInTheDocument()
      expect(screen.queryByText('movie.openInTmdb')).not.toBeInTheDocument()
    })

    it('opens TMDB movie page when clicking the TMDB link', () => {
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

      fireEvent.click(screen.getByText('movie.openInTmdb'))
      expect(openSpy).toHaveBeenCalledWith(
        'https://www.themoviedb.org/movie/789',
        '_blank',
        'noopener,noreferrer',
      )
    })

    it('opens TVDB search page with id and name when clicking the TVDB link', () => {
      renderWithQueryClient(
        <MovieHeaderV2
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/movie',
              mediaFiles: [],
              movie: { id: 'tvdb-1', name: 'TVDB Movie Name', database: 'TVDB' },
            } as UIMediaMetadata
          }
        />
      )

      fireEvent.click(screen.getByText('movie.openInTvdb'))
      expect(openSpy).toHaveBeenCalledWith(
        'https://www.thetvdb.com/search?query=tvdb-1%20TVDB%20Movie%20Name',
        '_blank',
        'noopener,noreferrer',
      )
    })

    it('disables the external link when no movie metadata is present', () => {
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

      const menuItem = screen.getByText('movie.openInTmdb')
      expect(menuItem.closest('[role="menuitem"]')).toHaveAttribute('aria-disabled', 'true')
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

    it('shows loading skeleton and hides searchbox when selected folder status is loading', () => {
      renderWithQueryClient(
        <MovieHeaderV2
          {...defaultProps}
          selectedMediaMetadata={okMetadata}
          selectedMediaFolder={{ path: '/media/movie', status: 'loading' }}
        />
      )

      expect(screen.queryByPlaceholderText('movie.searchPlaceholder')).not.toBeInTheDocument()
    })

    it('shows loading skeleton and hides searchbox when selectedMediaFolder is undefined', () => {
      renderWithQueryClient(
        <MovieHeaderV2
          {...defaultProps}
          selectedMediaMetadata={okMetadata}
          selectedMediaFolder={undefined}
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

  describe('Subtitle menu / synthesize', () => {
    const okMovie = {
      status: 'ok' as const,
      mediaFolderPath: '/media/movie',
      mediaFiles: [],
      movie: { id: '789', name: 'Test Movie', database: 'TMDB' as const },
    } as UIMediaMetadata

    it('disables subtitle dropdown when transcribe, translate, synthesize, and process are all blocked', () => {
      renderWithQueryClient(
        <MovieHeaderV2
          {...defaultProps}
          selectedMediaMetadata={okMovie}
          selectedMediaFolder={{ path: '/media/movie', status: 'ok' }}
        />,
      )
      expect(screen.getByTestId('movie-header-subtitle')).toBeDisabled()
    })

    it('invokes onSynthesizeClick when synthesize menu item is used', () => {
      const onSynthesizeClick = vi.fn()
      renderWithQueryClient(
        <MovieHeaderV2
          {...defaultProps}
          selectedMediaMetadata={okMovie}
          selectedMediaFolder={{ path: '/media/movie', status: 'ok' }}
          onSynthesizeClick={onSynthesizeClick}
          isSynthesizeAvailable
          hasSynthesizeTargets
        />,
      )
      fireEvent.click(screen.getByTestId('movie-header-synthesize'))
      expect(onSynthesizeClick).toHaveBeenCalledTimes(1)
    })

    it('invokes onProcessClick when process menu item is used', () => {
      const onProcessClick = vi.fn()
      renderWithQueryClient(
        <MovieHeaderV2
          {...defaultProps}
          selectedMediaMetadata={okMovie}
          selectedMediaFolder={{ path: '/media/movie', status: 'ok' }}
          onProcessClick={onProcessClick}
          isProcessAvailable
          hasProcessTargets
        />,
      )
      fireEvent.click(screen.getByTestId('movie-header-process'))
      expect(onProcessClick).toHaveBeenCalledTimes(1)
    })
  })
})
