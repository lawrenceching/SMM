import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TvShowHeaderV2 } from './TvShowHeaderV2'
import type { UIMediaMetadata } from '@/types/UIMediaMetadata'
import type { UIMediaFolder } from '@/types/UIMediaFolder'

const mockMediaDatabaseSearchbox = vi.fn((props: any) => (
  <div data-testid="media-database-searchbox" data-value={props.value ?? ''} />
))

vi.mock('./MediaDatabaseSearchbox', () => ({
  MediaDatabaseSearchbox: (props: any) => mockMediaDatabaseSearchbox(props),
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

describe('TvShowHeaderV2', () => {
  const defaultProps = {
    onSearchResultSelected: vi.fn(),
    onRecognizeButtonClick: vi.fn(),
    onRenameClick: vi.fn(),
    selectedMediaMetadata: undefined as UIMediaMetadata | undefined,
    selectedMediaFolder: undefined as UIMediaFolder | undefined,
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
          selectedMediaFolder={{ path: '/media/show', status: 'ok' }}
        />
      )
      const moreButton = screen.getByRole('button', { name: 'tvShow.more' })
      expect(moreButton).not.toBeDisabled()
    })

    it('enables the more menu button when tvShow has TMDB id', () => {
      render(
        <TvShowHeaderV2
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/show',
              mediaFiles: [],
              tvShow: { id: '123', name: 'Test Show', database: 'TMDB', seasons: [] },
            } as UIMediaMetadata
          }
          selectedMediaFolder={{ path: '/media/show', status: 'ok' }}
        />
      )
      const moreButton = screen.getByRole('button', { name: 'tvShow.more' })
      expect(moreButton).not.toBeDisabled()
    })

    it('enables the more menu button when tvShow.id is available', () => {
      render(
        <TvShowHeaderV2
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/movie',
              mediaFiles: [],
              tvShow: { id: '456', name: 'Test Show', database: 'TMDB', seasons: [] },
            } as UIMediaMetadata
          }
          selectedMediaFolder={{ path: '/media/movie', status: 'ok' }}
        />
      )
      const moreButton = screen.getByRole('button', { name: 'tvShow.more' })
      expect(moreButton).not.toBeDisabled()
    })
  })

  describe('TVDB TV Show Metadata', () => {
    it('passes tvShow.name as value for TVDB metadata', () => {
      render(
        <TvShowHeaderV2
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/show',
              mediaFiles: [],
              tvShow: { id: 'tvdb-1', name: 'TVDB Show Name', database: 'TVDB', seasons: [] },
            } as UIMediaMetadata
          }
          selectedMediaFolder={{ path: '/media/show', status: 'ok' }}
        />
      )

      expect(mockMediaDatabaseSearchbox).toHaveBeenCalled()
      const firstCallProps = mockMediaDatabaseSearchbox.mock.calls[0]?.[0]
      expect(firstCallProps?.value).toBe('TVDB Show Name')
    })
  })

  describe('external link (TMDB / TVDB)', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    afterEach(() => {
      openSpy.mockClear()
    })

    it('shows "Open in TMDB" when database is TMDB', () => {
      render(
        <TvShowHeaderV2
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/show',
              mediaFiles: [],
              tvShow: { id: '123', name: 'Test Show', database: 'TMDB', seasons: [] },
            } as UIMediaMetadata
          }
          selectedMediaFolder={{ path: '/media/show', status: 'ok' }}
        />
      )

      expect(screen.getByText('tvShow.openInTmdb')).toBeInTheDocument()
      expect(screen.queryByText('tvShow.openInTvdb')).not.toBeInTheDocument()
    })

    it('shows "Open in TVDB" when database is TVDB', () => {
      render(
        <TvShowHeaderV2
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/show',
              mediaFiles: [],
              tvShow: { id: 'tvdb-1', name: 'TVDB Show Name', database: 'TVDB', seasons: [] },
            } as UIMediaMetadata
          }
          selectedMediaFolder={{ path: '/media/show', status: 'ok' }}
        />
      )

      expect(screen.getByText('tvShow.openInTvdb')).toBeInTheDocument()
      expect(screen.queryByText('tvShow.openInTmdb')).not.toBeInTheDocument()
    })

    it('opens TMDB TV page when clicking the TMDB link', () => {
      render(
        <TvShowHeaderV2
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/show',
              mediaFiles: [],
              tvShow: { id: '123', name: 'Test Show', database: 'TMDB', seasons: [] },
            } as UIMediaMetadata
          }
          selectedMediaFolder={{ path: '/media/show', status: 'ok' }}
        />
      )

      fireEvent.click(screen.getByText('tvShow.openInTmdb'))
      expect(openSpy).toHaveBeenCalledWith(
        'https://www.themoviedb.org/tv/123',
        '_blank',
        'noopener,noreferrer',
      )
    })

    it('opens TVDB search page with id and name when clicking the TVDB link', () => {
      render(
        <TvShowHeaderV2
          {...defaultProps}
          selectedMediaMetadata={
            {
              status: 'ok',
              mediaFolderPath: '/media/show',
              mediaFiles: [],
              tvShow: { id: 'tvdb-1', name: 'TVDB Show Name', database: 'TVDB', seasons: [] },
            } as UIMediaMetadata
          }
          selectedMediaFolder={{ path: '/media/show', status: 'ok' }}
        />
      )

      fireEvent.click(screen.getByText('tvShow.openInTvdb'))
      expect(openSpy).toHaveBeenCalledWith(
        'https://www.thetvdb.com/search?query=tvdb-1%20TVDB%20Show%20Name',
        '_blank',
        'noopener,noreferrer',
      )
    })

    it('disables the external link when no media id is available', () => {
      render(
        <TvShowHeaderV2
          {...defaultProps}
          selectedMediaMetadata={{
            status: 'ok',
            mediaFolderPath: '/media/show',
            mediaFiles: [],
          } as UIMediaMetadata}
          selectedMediaFolder={{ path: '/media/show', status: 'ok' }}
        />
      )

      const menuItem = screen.getByText('tvShow.openInTmdb')
      expect(menuItem.closest('[role="menuitem"]')).toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('folder status driven loading state', () => {
    const okMetadata = {
      status: 'ok',
      mediaFolderPath: '/media/show',
      mediaFiles: [],
      tvShow: { id: 'tvdb-1', name: 'TVDB Show Name', database: 'TVDB', seasons: [] },
    } as UIMediaMetadata

    it('shows loading skeleton and hides searchbox when selected folder is loading', () => {
      render(
        <TvShowHeaderV2
          {...defaultProps}
          selectedMediaMetadata={okMetadata}
          selectedMediaFolder={{ path: '/media/show', status: 'loading' }}
        />
      )

      expect(mockMediaDatabaseSearchbox).not.toHaveBeenCalled()
      expect(screen.queryByTestId('media-database-searchbox')).not.toBeInTheDocument()
    })

    it('shows searchbox when selected folder status is ok', () => {
      render(
        <TvShowHeaderV2
          {...defaultProps}
          selectedMediaMetadata={okMetadata}
          selectedMediaFolder={{ path: '/media/show', status: 'ok' }}
        />
      )

      expect(screen.getByTestId('media-database-searchbox')).toBeInTheDocument()
    })
  })

  describe('Subtitle menu / synthesize', () => {
    const okTv = {
      status: 'ok' as const,
      mediaFolderPath: '/media/show',
      mediaFiles: [],
      tvShow: { id: '123', name: 'Test Show', database: 'TMDB' as const, seasons: [] },
    } as UIMediaMetadata

    it('disables subtitle dropdown when all subtitle actions are blocked', () => {
      render(
        <TvShowHeaderV2
          {...defaultProps}
          selectedMediaMetadata={okTv}
          selectedMediaFolder={{ path: '/media/show', status: 'ok' }}
        />,
      )
      expect(screen.getByTestId('tvshow-header-subtitle')).toBeDisabled()
    })

    it('invokes onSynthesizeClick when synthesize menu item is used', () => {
      const onSynthesizeClick = vi.fn()
      render(
        <TvShowHeaderV2
          {...defaultProps}
          selectedMediaMetadata={okTv}
          selectedMediaFolder={{ path: '/media/show', status: 'ok' }}
          onSynthesizeClick={onSynthesizeClick}
          isSynthesizeAvailable
          hasSynthesizeTargets
        />,
      )
      fireEvent.click(screen.getByTestId('tvshow-header-synthesize'))
      expect(onSynthesizeClick).toHaveBeenCalledTimes(1)
    })
  })
})
