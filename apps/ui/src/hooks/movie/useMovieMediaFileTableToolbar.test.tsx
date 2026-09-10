/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MovieMediaFileTableToolbar } from './useMovieMediaFileTableToolbar'
import type { MediaMetadata } from '@smm/types'
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react')
  return {
    DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
    DropdownMenuTrigger: ({ children, asChild: _asChild }: any) => <div data-testid="dropdown-trigger">{children}</div>,
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

describe('MovieMediaFileTableToolbar', () => {
  const defaultProps = {
    onSearchResultSelected: vi.fn(),
    onRenameClick: vi.fn(),
    selectedMediaMetadata: undefined as MediaMetadata | undefined,
    selectedMediaFolder: defaultOkFolder as UIMediaFolder | undefined,
    openScrape: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('"更多" dropdown / "在TMDB中打开"', () => {
    it('keeps the more menu button enabled when tmdb id is not available so overflow actions stay reachable', () => {
      renderWithQueryClient(
        <MovieMediaFileTableToolbar
          {...defaultProps}
          selectedMediaMetadata={{
            status: 'ok',
            mediaFolderPath: '/media/movie',
            mediaFiles: [],
          } as MediaMetadata}
        />
      )
      const moreButton = screen.getByRole('button', { name: 'tvShow.more' })
      expect(moreButton).not.toBeDisabled()
    })

    it('keeps the more menu button enabled when movie has no usable id', () => {
      renderWithQueryClient(
        <MovieMediaFileTableToolbar
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/movie',
              mediaFiles: [],
              movie: { name: 'Movie', id: '', database: 'TMDB' },
            } as MediaMetadata
          }
        />
      )
      const moreButton = screen.getByRole('button', { name: 'tvShow.more' })
      expect(moreButton).not.toBeDisabled()
    })

    it('enables the more menu button when movie has TMDB id', () => {
      renderWithQueryClient(
        <MovieMediaFileTableToolbar
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/movie',
              mediaFiles: [],
              movie: { id: '789', name: 'Test Movie', database: 'TMDB' },
            } as MediaMetadata
          }
        />
      )
      const moreButton = screen.getByRole('button', { name: 'tvShow.more' })
      expect(moreButton).not.toBeDisabled()
    })

    it('enables the more menu button when movie has TVDB id', () => {
      renderWithQueryClient(
        <MovieMediaFileTableToolbar
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/movie',
              mediaFiles: [],
              movie: { id: 'tvdb-1', name: 'TVDB Movie', database: 'TVDB' },
            } as MediaMetadata
          }
        />
      )
      const moreButton = screen.getByRole('button', { name: 'tvShow.more' })
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
        <MovieMediaFileTableToolbar
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/movie',
              mediaFiles: [],
              movie: { id: '789', name: 'Test Movie', database: 'TMDB' },
            } as MediaMetadata
          }
        />
      )

      expect(screen.getByText('tvShow.openInTmdb')).toBeInTheDocument()
      expect(screen.queryByText('tvShow.openInTvdb')).not.toBeInTheDocument()
    })

    it('shows "Open in TVDB" when database is TVDB', () => {
      renderWithQueryClient(
        <MovieMediaFileTableToolbar
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/movie',
              mediaFiles: [],
              movie: { id: 'tvdb-1', name: 'TVDB Movie Name', database: 'TVDB' },
            } as MediaMetadata
          }
        />
      )

      expect(screen.getByText('tvShow.openInTvdb')).toBeInTheDocument()
      expect(screen.queryByText('tvShow.openInTmdb')).not.toBeInTheDocument()
    })

    it('opens TMDB movie page when clicking the TMDB link', () => {
      renderWithQueryClient(
        <MovieMediaFileTableToolbar
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/movie',
              mediaFiles: [],
              movie: { id: '789', name: 'Test Movie', database: 'TMDB' },
            } as MediaMetadata
          }
        />
      )

      fireEvent.click(screen.getByText('tvShow.openInTmdb'))
      expect(openSpy).toHaveBeenCalledWith(
        'https://www.themoviedb.org/movie/789',
        '_blank',
        'noopener,noreferrer',
      )
    })

    it('opens TVDB search page with id and name when clicking the TVDB link', () => {
      renderWithQueryClient(
        <MovieMediaFileTableToolbar
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/movie',
              mediaFiles: [],
              movie: { id: 'tvdb-1', name: 'TVDB Movie Name', database: 'TVDB' },
            } as MediaMetadata
          }
        />
      )

      fireEvent.click(screen.getByText('tvShow.openInTvdb'))
      expect(openSpy).toHaveBeenCalledWith(
        'https://www.thetvdb.com/search?query=tvdb-1%20TVDB%20Movie%20Name',
        '_blank',
        'noopener,noreferrer',
      )
    })

    it('disables the external link when no movie metadata is present', () => {
      renderWithQueryClient(
        <MovieMediaFileTableToolbar
          {...defaultProps}
          selectedMediaMetadata={{
            status: 'ok',
            mediaFolderPath: '/media/movie',
            mediaFiles: [],
          } as MediaMetadata}
        />
      )

      const menuItem = screen.getByText('tvShow.openInTmdb')
      expect(menuItem.closest('[role="menuitem"]')).toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('folder status driven loading state', () => {
    const okMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/movie',
      mediaFiles: [],
      movie: { id: '789', name: 'Test Movie', database: 'TMDB' },
    } as MediaMetadata

    it('shows loading skeleton and hides searchbox when selected folder is updating', () => {
      renderWithQueryClient(
        <MovieMediaFileTableToolbar
          {...defaultProps}
          selectedMediaMetadata={okMetadata}
          selectedMediaFolder={{ path: '/media/movie', status: 'updating' }}
        />
      )

      expect(screen.queryByPlaceholderText('movie.searchPlaceholder')).not.toBeInTheDocument()
    })

    it('shows loading skeleton and hides searchbox when selected folder status is loading', () => {
      renderWithQueryClient(
        <MovieMediaFileTableToolbar
          {...defaultProps}
          selectedMediaMetadata={okMetadata}
          selectedMediaFolder={{ path: '/media/movie', status: 'loading' }}
        />
      )

      expect(screen.queryByPlaceholderText('movie.searchPlaceholder')).not.toBeInTheDocument()
    })

    it('shows loading skeleton and hides searchbox when selectedMediaFolder is undefined', () => {
      renderWithQueryClient(
        <MovieMediaFileTableToolbar
          {...defaultProps}
          selectedMediaMetadata={okMetadata}
          selectedMediaFolder={undefined}
        />
      )

      expect(screen.queryByPlaceholderText('movie.searchPlaceholder')).not.toBeInTheDocument()
    })

    it('shows searchbox when selected folder status is ok', () => {
      renderWithQueryClient(
        <MovieMediaFileTableToolbar
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
    } as MediaMetadata

    it('disables subtitle dropdown when transcribe, translate, synthesize, and process are all blocked', () => {
      renderWithQueryClient(
        <MovieMediaFileTableToolbar
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
        <MovieMediaFileTableToolbar
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
        <MovieMediaFileTableToolbar
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
