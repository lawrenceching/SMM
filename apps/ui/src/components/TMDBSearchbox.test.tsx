import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TMDBSearchbox } from './TMDBSearchbox'
import type { TMDBTVShow, TMDBMovie } from '@core/types'

const mockImmersiveSearchboxValue = { current: '' }

vi.mock('./ImmersiveSearchbox', () => ({
  ImmersiveSearchbox: vi.fn(({ value, onChange, onSearch, onSelect, searchResults, isSearching, searchError, placeholder, inputClassName }) => {
    mockImmersiveSearchboxValue.current = value
    return (
      <div data-testid="immersive-searchbox">
        <input
          data-testid="search-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClassName}
        />
      </div>
    )
  }),
}))

vi.mock('@/api/tmdb', () => ({
  searchTmdb: vi.fn(),
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
}))

describe('TMDBSearchbox', () => {
  const defaultProps = {
    mediaType: 'tv' as const,
    onSearchResultSelected: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockImmersiveSearchboxValue.current = ''
  })

  it('passes value1 to ImmersiveSearchbox when value prop is value1', () => {
    const value1 = 'Test TV Show 1'
    render(<TMDBSearchbox {...defaultProps} value={value1} />)

    expect(mockImmersiveSearchboxValue.current).toBe(value1)
  })

  it('updates ImmersiveSearchbox value when value prop changes from value1 to value2', () => {
    const value1 = 'Test TV Show 1'
    const value2 = 'Test TV Show 2'

    const { rerender } = render(<TMDBSearchbox {...defaultProps} value={value1} />)

    expect(mockImmersiveSearchboxValue.current).toBe(value1)

    rerender(<TMDBSearchbox {...defaultProps} value={value2} />)

    expect(mockImmersiveSearchboxValue.current).toBe(value2)
  })
})
