import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { useConfig } from '@/providers/config-provider'
import { MediaDatabaseSearchbox } from './MediaDatabaseSearchbox'

const mockImmersiveSearchboxValue = { current: '' }

vi.mock('./ImmersiveSearchbox', () => ({
  ImmersiveSearchbox: vi.fn((props: any) => {
    const { value, onChange, placeholder, inputClassName, onSelect } = props
    mockImmersiveSearchboxValue.current = value
    const fakeResult = { id: 1, name: 'Test Show' }
    return (
      <div data-testid="immersive-searchbox">
        <input
          data-testid="search-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClassName}
        />
        <button
          type="button"
          data-testid="select-result"
          onClick={() => onSelect(fakeResult)}
        >
          Select
        </button>
      </div>
    )
  }),
}))

vi.mock('./ImmersiveSearchboxTvdb', () => ({
  ImmersiveSearchboxTvdb: vi.fn((props: any) => {
    const { value, onChange, placeholder, inputClassName, onSelect } = props
    mockImmersiveSearchboxValue.current = value
    const fakeResult = { tvdb_id: 42, name: 'TVDB Show' }
    return (
      <div data-testid="immersive-searchbox-tvdb">
        <input
          data-testid="search-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClassName}
        />
        <button
          type="button"
          data-testid="select-result-tvdb"
          onClick={() => onSelect(fakeResult)}
        >
          Select
        </button>
      </div>
    )
  }),
}))

vi.mock('@/api/tmdb', () => ({
  searchTmdb: vi.fn(),
}))

vi.mock('@/api/tvdb', () => ({
  searchTvdb: vi.fn(),
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

vi.mock('@/providers/config-provider', () => ({
  useConfig: vi.fn(() => ({
    userConfig: {
      applicationLanguage: 'en',
      primaryDatabase: 'TMDB',
    },
  })),
}))

describe('MediaDatabaseSearchbox', () => {
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
    render(<MediaDatabaseSearchbox {...defaultProps} value={value1} />)

    expect(mockImmersiveSearchboxValue.current).toBe(value1)
  })

  it('updates ImmersiveSearchbox value when value prop changes from value1 to value2', () => {
    const value1 = 'Test TV Show 1'
    const value2 = 'Test TV Show 2'

    const { rerender } = render(<MediaDatabaseSearchbox {...defaultProps} value={value1} />)

    expect(mockImmersiveSearchboxValue.current).toBe(value1)

    rerender(<MediaDatabaseSearchbox {...defaultProps} value={value2} />)

    expect(mockImmersiveSearchboxValue.current).toBe(value2)
  })

  it('calls onSearchResultSelected with result, searchLanguage, and database when result is selected', () => {
    const onSearchResultSelected = vi.fn()
    vi.mocked(useConfig).mockReturnValue({
      userConfig: {
        applicationLanguage: 'en',
        primaryDatabase: 'TVDB',
      },
    } as any)

    const { getByTestId } = render(
      <MediaDatabaseSearchbox
        mediaType="tv"
        onSearchResultSelected={onSearchResultSelected}
      />
    )

    getByTestId('select-result-tvdb').click()

    expect(onSearchResultSelected).toHaveBeenCalledTimes(1)
    expect(onSearchResultSelected).toHaveBeenCalledWith(
      expect.objectContaining({
        database: 'TVDB',
        searchLanguage: 'en-US',
      })
    )
  })
})
