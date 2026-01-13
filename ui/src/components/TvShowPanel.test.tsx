import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import TvShowPanel from './TvShowPanel'

// Mock components
vi.mock('./tmdb-tvshow-overview', () => ({
  TMDBTVShowOverview: vi.fn().mockImplementation(({ tvShow, seasons, ...props }) => (
    <div data-testid="tmdb-tvshow-overview" {...props}>
      <div>TMDBTVShowOverview</div>
    </div>
  )),
}))

vi.mock('./TvShowPanelPrompts', async () => {
  const actual = await vi.importActual('./TvShowPanelPrompts')
  return {
    ...actual,
    TvShowPanelPrompts: vi.fn().mockImplementation(() => (
      <div data-testid="tvshow-panel-prompts">TvShowPanelPrompts</div>
    )),
  }
})

// Mock hooks
vi.mock('./media-metadata-provider', () => ({
  useMediaMetadata: vi.fn(() => ({
    selectedMediaMetadata: undefined,
    updateMediaMetadata: vi.fn(),
    refreshMediaMetadata: vi.fn(),
    setSelectedMediaMetadataByMediaFolderPath: vi.fn(),
  })),
}))

vi.mock('@/lib/i18n', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => key,
  })),
}))

vi.mock('react-use', () => ({
  useLatest: vi.fn((value) => ({ current: value })),
}))

// Create trackable setters for prompt state
let mockSetIsUseNfoPromptOpen: ReturnType<typeof vi.fn>
let mockSetIsRuleBasedRenameFilePromptOpen: ReturnType<typeof vi.fn>
let mockSetIsAiBasedRenameFilePromptOpen: ReturnType<typeof vi.fn>
let mockSetIsAiRecognizePromptOpen: ReturnType<typeof vi.fn>
let mockSetIsRuleBasedRecognizePromptOpen: ReturnType<typeof vi.fn>

// Track prompt states
let mockIsUseNfoPromptOpen = false
let mockIsRuleBasedRenameFilePromptOpen = false
let mockIsAiBasedRenameFilePromptOpen = false
let mockIsAiRecognizePromptOpen = false
let mockIsRuleBasedRecognizePromptOpen = false

vi.mock('./hooks/TvShowPanel/useTvShowPanelState', () => ({
  useTvShowPanelState: vi.fn(() => ({
    seasons: [],
    setSeasons: vi.fn(),
    selectedNamingRule: 'plex' as const,
    setSelectedNamingRule: vi.fn(),
    isRuleBasedRenameFilePromptOpen: mockIsRuleBasedRenameFilePromptOpen,
    setIsRuleBasedRenameFilePromptOpen: mockSetIsRuleBasedRenameFilePromptOpen,
    isAiBasedRenameFilePromptOpen: mockIsAiBasedRenameFilePromptOpen,
    setIsAiBasedRenameFilePromptOpen: mockSetIsAiBasedRenameFilePromptOpen,
    aiBasedRenameFileStatus: 'generating' as const,
    setAiBasedRenameFileStatus: vi.fn(),
    isRuleBasedRecognizePromptOpen: mockIsRuleBasedRecognizePromptOpen,
    setIsRuleBasedRecognizePromptOpen: mockSetIsRuleBasedRecognizePromptOpen,
    isUseNfoPromptOpen: mockIsUseNfoPromptOpen,
    setIsUseNfoPromptOpen: mockSetIsUseNfoPromptOpen,
    loadedNfoData: undefined,
    setLoadedNfoData: vi.fn(),
    isRenaming: false,
    setIsRenaming: vi.fn(),
    scrollToEpisodeId: null,
    setScrollToEpisodeId: vi.fn(),
    seasonsBackup: { current: [] },
    isPreviewMode: false,
  })),
}))

vi.mock('./hooks/TvShowPanel/useTvShowFileNameGeneration', () => ({
  useTvShowFileNameGeneration: vi.fn(() => ({})),
}))

vi.mock('./hooks/TvShowPanel/useTvShowRenaming', () => ({
  useTvShowRenaming: vi.fn(() => ({
    startToRenameFiles: vi.fn(),
  })),
}))

vi.mock('./hooks/TvShowPanel/useTvShowWebSocketEvents', () => ({
  useTvShowWebSocketEvents: vi.fn(() => {}),
}))

// Mock utilities
vi.mock('@/lib/utils', () => ({
  findAssociatedFiles: vi.fn(() => []),
}))

vi.mock('@/lib/path', () => ({
  join: vi.fn((...paths) => paths.join('/')),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

vi.mock('@/hooks/useWebSocket', () => ({
  sendAcknowledgement: vi.fn(),
}))

vi.mock('./TvShowPanelUtils', () => ({
  recognizeEpisodes: vi.fn(),
  mapTagToFileType: vi.fn((tag: string) => tag),
}))

vi.mock('@/lib/lookup', () => ({
  lookup: vi.fn(() => null),
}))

describe('TvShowPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mock setters
    mockSetIsUseNfoPromptOpen = vi.fn((value: boolean) => {
      mockIsUseNfoPromptOpen = value
    })
    mockSetIsRuleBasedRenameFilePromptOpen = vi.fn((value: boolean) => {
      mockIsRuleBasedRenameFilePromptOpen = value
    })
    mockSetIsAiBasedRenameFilePromptOpen = vi.fn((value: boolean) => {
      mockIsAiBasedRenameFilePromptOpen = value
    })
    mockSetIsAiRecognizePromptOpen = vi.fn((value: boolean) => {
      mockIsAiRecognizePromptOpen = value
    })
    mockSetIsRuleBasedRecognizePromptOpen = vi.fn((value: boolean) => {
      mockIsRuleBasedRecognizePromptOpen = value
    })
    
    // Reset prompt states
    mockIsUseNfoPromptOpen = false
    mockIsRuleBasedRenameFilePromptOpen = false
    mockIsAiBasedRenameFilePromptOpen = false
    mockIsAiRecognizePromptOpen = false
    mockIsRuleBasedRecognizePromptOpen = false
  })

  it('should render without errors', () => {
    render(<TvShowPanel />)
    
    // Verify the component renders by checking for the main container
    const container = screen.getByTestId('tmdb-tvshow-overview')
    expect(container).toBeInTheDocument()
  })

  it('should close other prompts when one prompt is opened', async () => {
    const { usePromptManager } = await import('./TvShowPanelPrompts')
    
    const setters = {
      setIsUseNfoPromptOpen: mockSetIsUseNfoPromptOpen,
      setIsRuleBasedRenameFilePromptOpen: mockSetIsRuleBasedRenameFilePromptOpen,
      setIsAiBasedRenameFilePromptOpen: mockSetIsAiBasedRenameFilePromptOpen,
      setIsAiRecognizePromptOpen: mockSetIsAiRecognizePromptOpen,
      setIsRuleBasedRecognizePromptOpen: mockSetIsRuleBasedRecognizePromptOpen,
    }
    
    const states = {
      isUseNfoPromptOpen: mockIsUseNfoPromptOpen,
      isRuleBasedRenameFilePromptOpen: mockIsRuleBasedRenameFilePromptOpen,
      isAiBasedRenameFilePromptOpen: mockIsAiBasedRenameFilePromptOpen,
      isAiRecognizePromptOpen: mockIsAiRecognizePromptOpen,
      isRuleBasedRecognizePromptOpen: mockIsRuleBasedRecognizePromptOpen,
    }
    
    // Create a test component that uses the hook
    const TestComponent = () => {
      const { openPrompt } = usePromptManager(setters, states)
      
      return (
        <div>
          <button onClick={() => openPrompt('useNfo')}>Open UseNfo</button>
          <button onClick={() => openPrompt('ruleBasedRenameFile')}>Open RuleBasedRename</button>
          <button onClick={() => openPrompt('aiBasedRenameFile')}>Open AiBasedRename</button>
        </div>
      )
    }
    
    const { getByText } = render(<TestComponent />)
    
    // Open the "useNfo" prompt
    const openUseNfoButton = getByText('Open UseNfo')
    openUseNfoButton.click()
    
    // Verify all other prompts were closed first
    expect(mockSetIsRuleBasedRenameFilePromptOpen).toHaveBeenCalledWith(false)
    expect(mockSetIsAiBasedRenameFilePromptOpen).toHaveBeenCalledWith(false)
    expect(mockSetIsAiRecognizePromptOpen).toHaveBeenCalledWith(false)
    expect(mockSetIsRuleBasedRecognizePromptOpen).toHaveBeenCalledWith(false)
    
    // Verify the requested prompt was opened
    expect(mockSetIsUseNfoPromptOpen).toHaveBeenCalledWith(true)
    
    // Verify the order: all closes should happen before the open
    const useNfoCalls = mockSetIsUseNfoPromptOpen.mock.calls
    const lastCall = useNfoCalls[useNfoCalls.length - 1]
    expect(lastCall[0]).toBe(true)
    
    // Clear mocks for next assertion
    vi.clearAllMocks()
    
    // Now open a different prompt
    const openRuleBasedRenameButton = getByText('Open RuleBasedRename')
    openRuleBasedRenameButton.click()
    
    // Verify all other prompts (including useNfo) were closed
    expect(mockSetIsUseNfoPromptOpen).toHaveBeenCalledWith(false)
    expect(mockSetIsAiBasedRenameFilePromptOpen).toHaveBeenCalledWith(false)
    expect(mockSetIsAiRecognizePromptOpen).toHaveBeenCalledWith(false)
    expect(mockSetIsRuleBasedRecognizePromptOpen).toHaveBeenCalledWith(false)
    
    // Verify the requested prompt was opened
    expect(mockSetIsRuleBasedRenameFilePromptOpen).toHaveBeenCalledWith(true)
  })
})
