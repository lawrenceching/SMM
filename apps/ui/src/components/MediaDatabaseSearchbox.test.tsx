import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useConfig } from '@/hooks/userConfig'
import { MediaDatabaseSearchbox } from './MediaDatabaseSearchbox'
import localStorages from '@/lib/localStorages'

const mockImmersiveSearchboxProps = {
  current: {} as {
    value: string
    searchLanguage: string
    onSearchLanguageChange: (v: string) => void
    showAllLanguages: boolean
    onShowAllLanguagesChange: (v: boolean) => void
    searchLanguageOptions: ReadonlyArray<{ code: string; name: string }>
  },
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  })
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

vi.mock('./ImmersiveSearchbox', () => ({
  ImmersiveSearchbox: vi.fn((props: any) => {
    const { value, onChange, placeholder, inputClassName, onSelect, searchLanguage, onSearchLanguageChange, showAllLanguages, onShowAllLanguagesChange, searchLanguageOptions } = props
    mockImmersiveSearchboxProps.current = { value, searchLanguage, onSearchLanguageChange, showAllLanguages, onShowAllLanguagesChange, searchLanguageOptions }
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
        <span data-testid="language-options-count">
          {(searchLanguageOptions ?? []).length}
        </span>
      </div>
    )
  }),
}))

vi.mock('@/hooks/useMediaDatabaseBaseUrls', () => ({
  useMediaDatabaseBaseUrls: vi.fn(() => []),
}))

vi.mock('@/hooks/useTmdbLanguages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useTmdbLanguages')>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockFn = vi.fn<any>(() => ({
    data: [
      { code: 'zh-CN', name: '中文 (zh-CN)' },
      { code: 'en-US', name: 'English (en-US)' },
      { code: 'ja-JP', name: '日本語 (ja-JP)' },
      { code: 'fr-FR', name: 'Français (fr-FR)' },
      { code: 'de-DE', name: 'Deutsch (de-DE)' },
    ],
    isLoading: false,
    error: null,
  }))
  // Expose on `globalThis` so individual tests can override the mock.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).__mockUseTmdbSearchLanguageOptions = mockFn
  return {
    ...actual,
    useTmdbSearchLanguageOptions: mockFn,
  }
})

vi.mock('@/hooks/useTvdbLanguages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useTvdbLanguages')>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockFn = vi.fn<any>(() => ({ data: [
    { id: 'eng', name: 'English', nativeName: 'English' },
    { id: 'zho', name: 'Chinese', nativeName: '中文' },
    { id: 'jpn', name: 'Japanese', nativeName: '日本語' },
    { id: 'fra', name: 'French', nativeName: 'Français' },
    { id: 'deu', name: 'German', nativeName: 'Deutsch' },
  ], isLoading: false, error: null }))
  // Expose on `globalThis` so individual tests can override the mock.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).__mockUseTvdbLanguages = mockFn
  return {
    ...actual,
    useTvdbLanguages: mockFn,
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
      preferMediaLanguage: 'en-US',
      tmdb: {},
      tvdb: {},
    },
  })),
}))

vi.mock('@/hooks/useResolvedLanguages', () => ({
  useResolvedLanguages: vi.fn(() => ({
    appLanguage: 'en',
    mediaLanguage: 'en-US',
  })),
}))

describe('MediaDatabaseSearchbox', () => {
  const defaultProps = {
    mediaType: 'tv' as const,
    onSearchResultSelected: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockImmersiveSearchboxProps.current = {} as any
    localStorages.lastSelectedTmdbLanguage = null
    localStorages.lastSelectedTvdbLanguage = null
    // Reset the language-option mock implementations so a loading-state override
    // from a previous test (e.g. the fallback-items test) does not bleed through.
    // `mockImplementation` restores the default data; `mockReset` would leave the
    // function returning undefined.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).__mockUseTmdbSearchLanguageOptions.mockImplementation(() => ({
      data: [
        { code: 'zh-CN', name: '中文 (zh-CN)' },
        { code: 'en-US', name: 'English (en-US)' },
        { code: 'ja-JP', name: '日本語 (ja-JP)' },
        { code: 'fr-FR', name: 'Français (fr-FR)' },
        { code: 'de-DE', name: 'Deutsch (de-DE)' },
      ],
      isLoading: false,
      error: null,
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).__mockUseTvdbLanguages.mockImplementation(() => ({ data: [
      { id: 'eng', name: 'English', nativeName: 'English' },
      { id: 'zho', name: 'Chinese', nativeName: '中文' },
      { id: 'jpn', name: 'Japanese', nativeName: '日本語' },
      { id: 'fra', name: 'French', nativeName: 'Français' },
      { id: 'deu', name: 'German', nativeName: 'Deutsch' },
    ], isLoading: false, error: null }))
    // Reset the useConfig mock to its default (TMDB) so any prior
    // `vi.mocked(useConfig).mockReturnValue(...)` calls don't leak between tests.
    vi.mocked(useConfig).mockReturnValue({
      userConfig: {
        applicationLanguage: 'en',
        primaryDatabase: 'TMDB',
        preferMediaLanguage: 'en-US',
        tmdb: {},
        tvdb: {},
      },
    } as any)
  })

  it('passes value1 to ImmersiveSearchbox when value prop is value1', () => {
    const value1 = 'Test TV Show 1'
    render(<MediaDatabaseSearchbox {...defaultProps} value={value1} />, { wrapper: createWrapper() })

    expect(mockImmersiveSearchboxProps.current.value).toBe(value1)
  })

  it('updates ImmersiveSearchbox value when value prop changes from value1 to value2', () => {
    const value1 = 'Test TV Show 1'
    const value2 = 'Test TV Show 2'

    const { rerender } = render(<MediaDatabaseSearchbox {...defaultProps} value={value1} />, { wrapper: createWrapper() })

    expect(mockImmersiveSearchboxProps.current.value).toBe(value1)

    rerender(<MediaDatabaseSearchbox {...defaultProps} value={value2} />)

    expect(mockImmersiveSearchboxProps.current.value).toBe(value2)
  })

  it('calls onSearchResultSelected with result, searchLanguage, and database when result is selected', () => {
    const onSearchResultSelected = vi.fn()
    vi.mocked(useConfig).mockReturnValue({
      userConfig: {
        applicationLanguage: 'en',
        primaryDatabase: 'TVDB',
        preferMediaLanguage: 'en-US',
        tmdb: {},
        tvdb: {},
      },
    } as any)

    const { getByTestId } = render(
      <MediaDatabaseSearchbox
        mediaType="tv"
        onSearchResultSelected={onSearchResultSelected}
      />,
      { wrapper: createWrapper() }
    )

    getByTestId('select-result').click()

    expect(onSearchResultSelected).toHaveBeenCalledTimes(1)
    expect(onSearchResultSelected).toHaveBeenCalledWith(
      expect.objectContaining({
        database: 'TVDB',
        searchLanguage: 'eng',
      })
    )
  })

  it('uses preferMediaLanguage as fallback when no localStorage value exists', () => {
    // localStorage is empty (set in beforeEach)
    // userConfig.preferMediaLanguage === 'en-US' (TMDB)
    render(<MediaDatabaseSearchbox {...defaultProps} />, { wrapper: createWrapper() })

    expect(mockImmersiveSearchboxProps.current.searchLanguage).toBe('en-US')
  })

  it('prefers localStorage value over userConfig.preferMediaLanguage', () => {
    localStorages.lastSelectedTmdbLanguage = 'fr-FR'
    render(<MediaDatabaseSearchbox {...defaultProps} />, { wrapper: createWrapper() })

    expect(mockImmersiveSearchboxProps.current.searchLanguage).toBe('fr-FR')
  })

  it('persists selected TMDB language to lastSelectedTmdbLanguage on user change', () => {
    render(<MediaDatabaseSearchbox {...defaultProps} />, { wrapper: createWrapper() })

    // Simulate user picking 'fr-FR' from the dropdown
    mockImmersiveSearchboxProps.current.onSearchLanguageChange('fr-FR')

    expect(localStorages.lastSelectedTmdbLanguage).toBe('fr-FR')
    expect(localStorages.lastSelectedTvdbLanguage).toBeNull()
  })

  it('falls back to eng (TVDB ISO 639-3) when localStorage is empty and database is TVDB', () => {
    vi.mocked(useConfig).mockReturnValue({
      userConfig: {
        applicationLanguage: 'en',
        primaryDatabase: 'TVDB',
        preferMediaLanguage: 'en-US',
        tmdb: {},
        tvdb: {},
      },
    } as any)

    render(<MediaDatabaseSearchbox {...defaultProps} />, { wrapper: createWrapper() })

    expect(mockImmersiveSearchboxProps.current.searchLanguage).toBe('eng')
  })

  it('prefers localStorage TVDB value (ISO 639-3) when present', () => {
    vi.mocked(useConfig).mockReturnValue({
      userConfig: {
        applicationLanguage: 'en',
        primaryDatabase: 'TVDB',
        preferMediaLanguage: 'en-US',
        tmdb: {},
        tvdb: {},
      },
    } as any)
    localStorages.lastSelectedTvdbLanguage = 'fra'

    render(<MediaDatabaseSearchbox {...defaultProps} />, { wrapper: createWrapper() })

    expect(mockImmersiveSearchboxProps.current.searchLanguage).toBe('fra')
  })

  it('persists selected TVDB language to lastSelectedTvdbLanguage on user change', () => {
    vi.mocked(useConfig).mockReturnValue({
      userConfig: {
        applicationLanguage: 'en',
        primaryDatabase: 'TVDB',
        preferMediaLanguage: 'en-US',
        tmdb: {},
        tvdb: {},
      },
    } as any)

    render(<MediaDatabaseSearchbox {...defaultProps} />, { wrapper: createWrapper() })

    mockImmersiveSearchboxProps.current.onSearchLanguageChange('fra')

    expect(localStorages.lastSelectedTvdbLanguage).toBe('fra')
    expect(localStorages.lastSelectedTmdbLanguage).toBeNull()
  })

  it('renders only the 3 default languages in collapsed view', () => {
    render(<MediaDatabaseSearchbox {...defaultProps} />, { wrapper: createWrapper() })

    expect(mockImmersiveSearchboxProps.current.showAllLanguages).toBe(false)
    expect(mockImmersiveSearchboxProps.current.searchLanguageOptions).toEqual([
      { code: 'zh-CN', name: '中文 (zh-CN)' },
      { code: 'en-US', name: 'English (en-US)' },
      { code: 'ja-JP', name: '日本語 (ja-JP)' },
    ])
  })

  it('appends the other languages in expanded view, keeping defaults at the top', () => {
    render(<MediaDatabaseSearchbox {...defaultProps} />, { wrapper: createWrapper() })

    act(() => {
      mockImmersiveSearchboxProps.current.onShowAllLanguagesChange(true)
    })

    expect(mockImmersiveSearchboxProps.current.showAllLanguages).toBe(true)
    // The 3 default languages are still pinned at the top, followed by
    // every other language. The defaults are NOT repeated.
    expect(mockImmersiveSearchboxProps.current.searchLanguageOptions).toEqual([
      { code: 'zh-CN', name: '中文 (zh-CN)' },
      { code: 'en-US', name: 'English (en-US)' },
      { code: 'ja-JP', name: '日本語 (ja-JP)' },
      { code: 'fr-FR', name: 'Français (fr-FR)' },
      { code: 'de-DE', name: 'Deutsch (de-DE)' },
    ])
  })

  it('toggles showAllLanguages when the consumer invokes the change handler', () => {
    render(<MediaDatabaseSearchbox {...defaultProps} />, { wrapper: createWrapper() })

    act(() => {
      mockImmersiveSearchboxProps.current.onShowAllLanguagesChange(true)
    })
    expect(mockImmersiveSearchboxProps.current.showAllLanguages).toBe(true)

    act(() => {
      mockImmersiveSearchboxProps.current.onShowAllLanguagesChange(false)
    })
    expect(mockImmersiveSearchboxProps.current.showAllLanguages).toBe(false)
  })

  it('renders the 3 priority fallback items when language data is still loading (undefined)', () => {
    // When the TanStack Query hook returns `data: undefined` (still loading),
    // `displayedLanguageOptions` must still produce the 3 priority items so
    // that `<SelectValue />` (bare) can find a match and display the current
    // `searchLanguage`. The fallback items use `getLanguageDisplayName(code)`
    // to show native-language names even while loading.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).__mockUseTmdbSearchLanguageOptions.mockImplementation(() => ({
      data: undefined,
      isLoading: true,
      error: null,
    }))

    render(<MediaDatabaseSearchbox {...defaultProps} />, { wrapper: createWrapper() })

    // The priority codes are rendered as fallback items with native names.
    expect(mockImmersiveSearchboxProps.current.searchLanguageOptions).toEqual([
      { code: 'zh-CN', name: '中文 (zh-CN)' },
      { code: 'en-US', name: 'English (en-US)' },
      { code: 'ja-JP', name: '日本語 (ja-JP)' },
    ])
  })

  it('also renders the selected non-priority language in fallback items when data is loading', () => {
    // When a non-priority language (e.g. "fr-FR") is stored in localStorage, it
    // must be included in the rendered `SelectItem`s even while the language list
    // is still loading, so that `<SelectValue />` (bare) can find a match.
    localStorages.lastSelectedTmdbLanguage = 'fr-FR'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).__mockUseTmdbSearchLanguageOptions.mockImplementation(() => ({
      data: undefined,
      isLoading: true,
      error: null,
    }))

    render(<MediaDatabaseSearchbox {...defaultProps} />, { wrapper: createWrapper() })

    // The 3 priority items + the selected "fr-FR" with native name are rendered.
    expect(mockImmersiveSearchboxProps.current.searchLanguageOptions).toEqual([
      { code: 'zh-CN', name: '中文 (zh-CN)' },
      { code: 'en-US', name: 'English (en-US)' },
      { code: 'ja-JP', name: '日本語 (ja-JP)' },
      { code: 'fr-FR', name: 'Français (fr-FR)' },
    ])
  })

  it('appends the selected non-priority language from the API (no duplicate) when expanded', () => {
    // When a non-priority language is stored in localStorage AND the language
    // list has been fetched from the API, the expanded view includes the API's
    // entry for that language (already in `rest`), followed by the remaining
    // languages. The fallback item is NOT prepended (API already has it), so
    // no duplicate appears.
    localStorages.lastSelectedTmdbLanguage = 'fr-FR'

    render(<MediaDatabaseSearchbox {...defaultProps} />, { wrapper: createWrapper() })

    // Verify that the component is actually reading fr-FR from localStorage.
    expect(mockImmersiveSearchboxProps.current.searchLanguage).toBe('fr-FR')

    act(() => {
      mockImmersiveSearchboxProps.current.onShowAllLanguagesChange(true)
    })

    // The expanded view contains 5 items: 3 priority + fr-FR (API entry, from `rest`)
    // + de-DE (rest). No fallback is prepended (API has fr-FR), so no duplicate.
    expect(mockImmersiveSearchboxProps.current.searchLanguageOptions).toHaveLength(5)
    expect(mockImmersiveSearchboxProps.current.searchLanguageOptions.map((o: { code: string }) => o.code)).toEqual([
      'zh-CN',
      'en-US',
      'ja-JP',
      'fr-FR',
      'de-DE',
    ])
    // Verify fr-FR appears once with the API name (not code-as-name).
    const frFR = mockImmersiveSearchboxProps.current.searchLanguageOptions.find(
      (o: { code: string }) => o.code === 'fr-FR',
    )
    expect(frFR).toBeDefined()
    expect(frFR!.name).toBe('Français (fr-FR)')
  })

  it('shows the selected non-priority language with native name in collapsed view when data is loaded', () => {
    // When a non-priority language is stored in localStorage AND the API has
    // returned the language list, the collapsed view shows the API entry (with
    // the native name) rather than the fallback code-as-name item.
    localStorages.lastSelectedTmdbLanguage = 'fr-FR'

    render(<MediaDatabaseSearchbox {...defaultProps} />, { wrapper: createWrapper() })

    expect(mockImmersiveSearchboxProps.current.searchLanguageOptions).toEqual([
      { code: 'zh-CN', name: '中文 (zh-CN)' },
      { code: 'en-US', name: 'English (en-US)' },
      { code: 'ja-JP', name: '日本語 (ja-JP)' },
      { code: 'fr-FR', name: 'Français (fr-FR)' },
    ])
  })
})
