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

vi.mock('./TvShowPanelPrompts', () => ({
  TvShowPanelPrompts: vi.fn().mockImplementation(() => (
    <div data-testid="tvshow-panel-prompts">TvShowPanelPrompts</div>
  )),
}))

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

vi.mock('./hooks/TvShowPanel/useTvShowPanelState', () => ({
  useTvShowPanelState: vi.fn(() => ({
    seasons: [],
    setSeasons: vi.fn(),
    selectedNamingRule: 'plex' as const,
    setSelectedNamingRule: vi.fn(),
    isRuleBasedRenameFilePromptOpen: false,
    setIsRuleBasedRenameFilePromptOpen: vi.fn(),
    isAiBasedRenameFilePromptOpen: false,
    setIsAiBasedRenameFilePromptOpen: vi.fn(),
    aiBasedRenameFileStatus: 'generating' as const,
    setAiBasedRenameFileStatus: vi.fn(),
    isRuleBasedRecognizePromptOpen: false,
    setIsRuleBasedRecognizePromptOpen: vi.fn(),
    isUseNfoPromptOpen: false,
    setIsUseNfoPromptOpen: vi.fn(),
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
  })

  it('should render without errors', () => {
    render(<TvShowPanel />)
    
    // Verify the component renders by checking for the main container
    const container = screen.getByTestId('tmdb-tvshow-overview')
    expect(container).toBeInTheDocument()
  })
})
