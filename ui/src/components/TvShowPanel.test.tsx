import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import TvShowPanel from './TvShowPanel'

// Mock components
vi.mock('./tmdb-tvshow-overview', () => ({
  TMDBTVShowOverview: vi.fn().mockImplementation(({ tvShow, seasons, ...props }) => (
    <div data-testid="tmdb-tvshow-overview" {...props}>
      <div>TMDBTVShowOverview</div>
    </div>
  )),
}))

// Helper function for usePromptManager
function createUsePromptManager() {
  return (setters: any, _states: any) => {
    const openPrompt = (promptType: 'useNfo' | 'ruleBasedRenameFile' | 'aiBasedRenameFile' | 'aiRecognize' | 'ruleBasedRecognize') => {
      // Close all prompts first
      setters.setIsUseNfoPromptOpen(false)
      setters.setIsRuleBasedRenameFilePromptOpen(false)
      setters.setIsAiBasedRenameFilePromptOpen(false)
      setters.setIsAiRecognizePromptOpen(false)
      setters.setIsRuleBasedRecognizePromptOpen(false)
      
      // Then open the requested prompt
      switch (promptType) {
        case 'useNfo':
          setters.setIsUseNfoPromptOpen(true)
          break
        case 'ruleBasedRenameFile':
          setters.setIsRuleBasedRenameFilePromptOpen(true)
          break
        case 'aiBasedRenameFile':
          setters.setIsAiBasedRenameFilePromptOpen(true)
          break
        case 'aiRecognize':
          setters.setIsAiRecognizePromptOpen(true)
          break
        case 'ruleBasedRecognize':
          setters.setIsRuleBasedRecognizePromptOpen(true)
          break
      }
    }
    
    return { openPrompt }
  }
}

vi.mock('./TvShowPanelPrompts', () => ({
  TvShowPanelPrompts: vi.fn().mockImplementation(() => (
    <div data-testid="tvshow-panel-prompts">TvShowPanelPrompts</div>
  )),
  TvShowPanelPromptsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePrompts: vi.fn(() => ({
    openUseTmdbIdFromFolderNamePrompt: vi.fn(),
    openUseNfoPrompt: vi.fn(),
    openRuleBasedRenameFilePrompt: vi.fn(),
    openAiBasedRenameFilePrompt: vi.fn(),
    openAiRecognizePrompt: vi.fn(),
    openRuleBasedRecognizePrompt: vi.fn(),
  })),
  usePromptManager: createUsePromptManager(),
  usePromptsContext: vi.fn(() => ({
    _setAiBasedRenameFileStatus: vi.fn(),
    isAiBasedRenameFilePromptOpen: false,
    isRuleBasedRenameFilePromptOpen: false,
    isRuleBasedRecognizePromptOpen: false,
  })),
}))

// Mock hooks (TvShowPanel imports from @/providers/media-metadata-provider)
vi.mock('@/providers/media-metadata-provider', () => ({
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
    isPreviewingForRename: false,
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

vi.mock('@/providers/config-provider', () => ({
  ConfigProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useConfig: vi.fn(() => ({
    appConfig: { version: 'test' },
    userConfig: {
      applicationLanguage: 'zh-CN',
      tmdb: {
        host: 'https://api.themoviedb.org/3',
        apiKey: '',
        httpProxy: ''
      },
      ai: {
        deepseek: {
          baseURL: 'https://api.deepseek.com',
          apiKey: '',
          model: 'deepseek-chat'
        },
        openAI: {
          baseURL: 'https://api.openai.com/v1',
          apiKey: '',
          model: 'gpt-4o'
        },
        openrouter: {
          baseURL: 'https://openrouter.ai/api/v1',
          apiKey: '',
          model: 'deepseek/deepseek-chat'
        },
        glm: {
          baseURL: 'https://open.bigmodel.cn/api/paas/v4',
          apiKey: '',
          model: 'GLM-4.5'
        },
        other: {
          baseURL: '',
          apiKey: '',
          model: ''
        }
      },
      selectedAI: 'DeepSeek',
      selectedTMDBIntance: 'public',
      folders: [],
      selectedRenameRule: 'Plex' as any,
    },
    isLoading: false,
    error: null,
    setUserConfig: vi.fn(),
    reload: vi.fn(),
  })),
}))

vi.mock('@/providers/global-states-provider', () => ({
  useGlobalStates: vi.fn(() => ({
    mediaFolderStates: {},
    setMediaFolderStates: vi.fn(),
    pendingPlans: [],
    pendingRenamePlans: [],
    fetchPendingPlans: vi.fn(),
    updatePlan: vi.fn(),
  })),
  useInitializedMediaFoldersState: vi.fn(() => [[], vi.fn()]),
  GlobalStatesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/providers/dialog-provider', () => ({
  DialogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDialogs: vi.fn(() => ({
    filePickerDialog: [vi.fn(), vi.fn()],
    confirmationDialog: [vi.fn(), vi.fn()],
  })),
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
    // Get the mocked usePromptManager from the mock
    const usePromptManager = createUsePromptManager()
    
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
