import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TVShowHeader } from './tv-show-header'
import type { TMDBTVShowDetails } from '@core/types'

vi.mock('./TMDBSearchbox', () => ({
  TMDBSearchbox: vi.fn().mockImplementation(({
    initialValue,
    onSearchResultSelected,
    placeholder,
  }) => (
    <div data-testid="tmdb-searchbox">
      <input
        data-testid="search-input"
        value={initialValue || ''}
        onChange={() => {}}
        placeholder={placeholder}
      />
      <button data-testid="search-button" onClick={() => onSearchResultSelected({ id: 1, name: 'Test' } as any)}>Search</button>
    </div>
  )),
}))

vi.mock('@/lib/i18n', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => key,
  })),
}))

vi.mock('@/providers/config-provider', () => ({
  useConfig: vi.fn(() => ({
    userConfig: {
      applicationLanguage: 'en-US',
    },
  })),
  ConfigProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const mockTvShow: TMDBTVShowDetails = {
  id: 123,
  name: 'Test TV Show',
  original_name: 'Original Test TV Show',
  overview: 'This is a test overview',
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  first_air_date: '2024-01-15',
  vote_average: 8.5,
  vote_count: 1000,
  popularity: 500,
  origin_country: ['US'],
  genre_ids: [18, 80],
  seasons: [],
  number_of_seasons: 1,
  number_of_episodes: 10,
  status: 'Returning Series',
  type: 'Scripted',
  in_production: true,
  last_air_date: '2024-06-01',
  networks: [],
  production_companies: [],
}

describe('TVShowHeader', () => {
  const defaultProps = {
    tvShow: mockTvShow,
    isUpdatingTvShow: false,
    onSearchResultSelected: vi.fn(),
    initialSearchValue: 'Test Query',
    onRecognizeButtonClick: vi.fn(),
    onRenameClick: vi.fn(),
    selectedMediaMetadata: undefined,
    openScrape: undefined,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders poster image when tvShow is provided', () => {
    render(<TVShowHeader {...defaultProps} />)
    const poster = screen.getByRole('img', { name: mockTvShow.name })
    expect(poster).toBeInTheDocument()
    expect(poster).toHaveAttribute('src', expect.stringContaining('w500'))
  })

  it('renders searchbox with correct props', () => {
    render(<TVShowHeader {...defaultProps} />)
    const searchbox = screen.getByTestId('tmdb-searchbox')
    expect(searchbox).toBeInTheDocument()
    const input = screen.getByTestId('search-input')
    expect(input).toHaveValue(defaultProps.initialSearchValue)
  })

  it('renders metadata badges', () => {
    render(<TVShowHeader {...defaultProps} />)
    expect(screen.getByText(/January/)).toBeInTheDocument()
    expect(screen.getByText(/8.5/)).toBeInTheDocument()
    expect(screen.getByText(/500/)).toBeInTheDocument()
  })

  it('renders original name when different from name', () => {
    render(<TVShowHeader {...defaultProps} />)
    expect(screen.getByText(mockTvShow.original_name)).toBeInTheDocument()
  })

  it('renders overview', () => {
    render(<TVShowHeader {...defaultProps} />)
    expect(screen.getByText(mockTvShow.overview)).toBeInTheDocument()
  })

  it('renders action buttons', () => {
    render(<TVShowHeader {...defaultProps} />)
    expect(screen.getByRole('button', { name: /Recognize/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rename/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Scrape/i })).toBeInTheDocument()
  })

  it('calls onRecognizeButtonClick when recognize button is clicked', () => {
    render(<TVShowHeader {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /Recognize/i }))
    expect(defaultProps.onRecognizeButtonClick).toHaveBeenCalledTimes(1)
  })

  it('calls onRenameClick when rename button is clicked', () => {
    render(<TVShowHeader {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /Rename/i }))
    expect(defaultProps.onRenameClick).toHaveBeenCalledTimes(1)
  })

  it('renders skeleton when isUpdatingTvShow is true', () => {
    render(<TVShowHeader {...defaultProps} isUpdatingTvShow />)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('does not render poster when tvShow is undefined', () => {
    render(<TVShowHeader {...defaultProps} tvShow={undefined} />)
    const poster = screen.queryByRole('img', { name: mockTvShow.name })
    expect(poster).not.toBeInTheDocument()
  })

  it('does not render overview when tvShow overview is empty', () => {
    const tvShowWithoutOverview = { ...mockTvShow, overview: '' }
    render(<TVShowHeader {...defaultProps} tvShow={tvShowWithoutOverview} />)
    expect(screen.queryByText('components:tvShow.overview')).not.toBeInTheDocument()
  })

  it('does not render original name when same as name', () => {
    const tvShowWithSameNames = { ...mockTvShow, original_name: mockTvShow.name }
    render(<TVShowHeader {...defaultProps} tvShow={tvShowWithSameNames} />)
    expect(screen.queryByText(mockTvShow.original_name)).not.toBeInTheDocument()
  })

  it('calls onSearchResultSelected when search result is selected', () => {
    render(<TVShowHeader {...defaultProps} />)
    fireEvent.click(screen.getByTestId('search-button'))
    expect(defaultProps.onSearchResultSelected).toHaveBeenCalledTimes(1)
  })

  it('disables scrape button when no media files', () => {
    render(<TVShowHeader {...defaultProps} selectedMediaMetadata={undefined} />)
    const scrapeButton = screen.getByRole('button', { name: /Scrape/i })
    expect(scrapeButton).toBeDisabled()
  })

  it('disables scrape button when media files are empty', () => {
    render(<TVShowHeader 
      {...defaultProps} 
      selectedMediaMetadata={{ mediaFiles: [], tmdbTvShow: mockTvShow } as any}
    />)
    const scrapeButton = screen.getByRole('button', { name: /Scrape/i })
    expect(scrapeButton).toBeDisabled()
  })
})
