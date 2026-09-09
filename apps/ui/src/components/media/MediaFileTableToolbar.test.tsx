/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MediaFileTableToolbar } from './MediaFileTableToolbar'

vi.mock('@/components/ui/dropdown-menu', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react')
  return {
    DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
    DropdownMenuTrigger: ({ children, asChild: _asChild }: any) => <div data-testid="dropdown-trigger">{children}</div>,
    DropdownMenuContent: ({ children }: any) => <div role="menu">{children}</div>,
    DropdownMenuItem: ({ children, disabled, onClick, className, ...rest }: any) => (
      <div role="menuitem" aria-disabled={disabled || undefined} className={className} onClick={onClick} {...rest}>{children}</div>
    ),
    DropdownMenuSeparator: ({ className }: any) => <hr className={className} />,
  }
})

vi.mock('@/lib/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/i18n')>()
  return {
    ...actual,
    useTranslation: vi.fn(() => ({
      t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    })),
  }
})

describe('MediaFileTableToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the leading slot', () => {
    render(
      <MediaFileTableToolbar
        leading={<div data-testid="leading">Search</div>}
      />,
    )
    expect(screen.getByTestId('leading')).toHaveTextContent('Search')
  })

  it('renders built-in rename/scrape and invokes callbacks', () => {
    const onRenameButtonClick = vi.fn()
    const onScrapeButtonClick = vi.fn()
    render(
      <MediaFileTableToolbar
        leading={<div>Search</div>}
        onRenameButtonClick={onRenameButtonClick}
        onScrapeButtonClick={onScrapeButtonClick}
      />,
    )

    fireEvent.click(screen.getByTestId('rename-button'))
    fireEvent.click(screen.getByTestId('scrape-button'))
    expect(onRenameButtonClick).toHaveBeenCalledTimes(1)
    expect(onScrapeButtonClick).toHaveBeenCalledTimes(1)
  })

  it('hides recognize when listed in hiddenMenuIds', () => {
    const { rerender } = render(
      <MediaFileTableToolbar
        leading={<div>Search</div>}
        hiddenMenuIds={['recognize']}
        onRecognizeButtonClick={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('recognize-button')).not.toBeInTheDocument()

    rerender(
      <MediaFileTableToolbar
        leading={<div>Search</div>}
        onRecognizeButtonClick={vi.fn()}
      />,
    )
    expect(screen.getByTestId('recognize-button')).toBeInTheDocument()
  })

  it('disables menu items listed in disabledMenuIds', () => {
    render(
      <MediaFileTableToolbar
        leading={<div>Search</div>}
        disabledMenuIds={['rename', 'scrape']}
      />,
    )
    expect(screen.getByTestId('rename-button')).toBeDisabled()
    expect(screen.getByTestId('scrape-button')).toBeDisabled()
  })

  it('hides subtitle menu and children when subtitle is hidden', () => {
    render(
      <MediaFileTableToolbar
        leading={<div>Search</div>}
        testIdPrefix="tvshow-header"
        hiddenMenuIds={['subtitle']}
        onTranscribeClick={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('tvshow-header-subtitle')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tvshow-header-transcribe')).not.toBeInTheDocument()
  })

  it('opens externalUrl from the More menu', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(
      <MediaFileTableToolbar
        leading={<div>Search</div>}
        externalUrl="https://www.themoviedb.org/tv/123"
      />,
    )
    fireEvent.click(screen.getByText('Open in TMDB'))
    expect(openSpy).toHaveBeenCalledWith(
      'https://www.themoviedb.org/tv/123',
      '_blank',
      'noopener,noreferrer',
    )
    openSpy.mockRestore()
  })

  it('disables openExternal when externalUrl is missing', () => {
    render(
      <MediaFileTableToolbar
        leading={<div>Search</div>}
      />,
    )
    expect(screen.getByText('Open in TMDB').closest('[role="menuitem"]')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('shows TVDB label when externalUrl points at TVDB', () => {
    render(
      <MediaFileTableToolbar
        leading={<div>Search</div>}
        externalUrl="https://www.thetvdb.com/search?query=1"
      />,
    )
    expect(screen.getByText('Open in TVDB')).toBeInTheDocument()
  })

  it('replaces leading and actions with skeletons while loading', () => {
    render(
      <MediaFileTableToolbar
        leading={<div data-testid="leading">Search</div>}
        loading
      />,
    )
    expect(screen.queryByTestId('leading')).not.toBeInTheDocument()
    expect(screen.queryByTestId('rename-button')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument()
  })

  it('reports layout changes and hides preview when showPreviewLayoutButton is false', () => {
    const onLayoutChange = vi.fn()
    const { rerender } = render(
      <MediaFileTableToolbar
        leading={<div>Search</div>}
        layout="simple"
        onLayoutChange={onLayoutChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Detail layout' }))
    expect(onLayoutChange).toHaveBeenCalledWith('detail')

    rerender(
      <MediaFileTableToolbar
        leading={<div>Search</div>}
        layout="simple"
        onLayoutChange={onLayoutChange}
        showPreviewLayoutButton={false}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Preview layout' })).not.toBeInTheDocument()
  })
})
