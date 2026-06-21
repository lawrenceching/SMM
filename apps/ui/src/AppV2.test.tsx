import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import AppV2 from "./AppV2"

const mockUseUIMediaFolderStoreState = vi.fn()
const mockUseMediaMetadataQuery = vi.fn()
const mockUseUIMediaFolderStore = vi.fn()
const mockGetState = vi.fn()
const { mockSetAndSaveUserConfig, mockLocalStorages } = vi.hoisted(() => ({
  mockSetAndSaveUserConfig: vi.fn(),
  mockLocalStorages: {
    sidebarSelectedFolder: null as string | null,
  },
}))

vi.mock("@/stores/uiMediaFolderStore", () => ({
  useUIMediaFolderStoreState: (...args: unknown[]) => mockUseUIMediaFolderStoreState(...args),
  useUIMediaFolderStore: Object.assign(
    (selector: (state: { folders: Array<{ path: string; status: string }> }) => unknown) =>
      mockUseUIMediaFolderStore(selector),
    {
      getState: () => mockGetState(),
    },
  ),
}))

vi.mock("@/hooks/mediaMetadata", () => ({
  useMediaMetadataQuery: (...args: unknown[]) => mockUseMediaMetadataQuery(...args),
  mediaMetadataQueryKey: vi.fn(),
  normalizeMediaFolderPathForQuery: (p: string) => p,
}))

vi.mock("@/hooks/userConfig", () => ({
  useConfig: () => ({
    userConfig: { folders: ["/media/local-folder"] },
    setAndSaveUserConfig: mockSetAndSaveUserConfig,
    isUserConfigLoaded: true,
  }),
}))

vi.mock("@/lib/localStorages", () => ({
  default: mockLocalStorages,
}))

vi.mock("@/providers/dialog-provider", () => ({
  useDialogs: () => ({
    openFolderDialog: [vi.fn(), vi.fn()],
    filePickerDialog: [vi.fn(), vi.fn()],
  }),
}))

vi.mock("@/components/v2/Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}))

vi.mock("@/components/v2/Toolbar", () => ({
  Toolbar: () => <div data-testid="toolbar" />,
}))

vi.mock("./ai/Assistant", () => ({
  Assistant: () => <div data-testid="assistant" />,
}))

vi.mock("./components/StatusBar", () => ({
  StatusBar: () => <div data-testid="statusbar" />,
}))

vi.mock("./components/AppWarningBanner", () => ({
  AppWarningBanner: () => <div data-testid="warning-banner" />,
}))

vi.mock("./components/welcome", () => ({
  default: () => <div data-testid="welcome" />,
}))

vi.mock("./components/tv/TvShowPanel", () => ({
  default: () => <div data-testid="tvshow-panel" />,
}))

vi.mock("./components/movie/MoviePanel", () => ({
  default: () => <div data-testid="movie-panel" />,
}))

vi.mock("./components/music/MusicPanel", () => ({
  MusicPanel: () => <div data-testid="music-panel" />,
}))

vi.mock("./components/LocalFilePanel", () => ({
  LocalFilePanel: ({ mediaFolderPath }: { mediaFolderPath: string }) => (
    <div data-testid="local-file-panel">{mediaFolderPath}</div>
  ),
}))

vi.mock("./components/ui/sonner", () => ({
  Toaster: () => <div data-testid="toaster" />,
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}))

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AppV2 />
    </QueryClientProvider>,
  )
}

describe("AppV2", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSetAndSaveUserConfig.mockReset()
    mockLocalStorages.sidebarSelectedFolder = null
  })

  function arrange({
    folderStatus,
  }: {
    folderStatus: "ok" | "error_loading_metadata" | "loading"
  }) {
    const selectedFolder = "/media/local-folder"
    const folders = [{ path: selectedFolder, status: folderStatus }]

    mockUseUIMediaFolderStoreState.mockReturnValue({
      folders,
      selectedFolder,
    })
    mockUseUIMediaFolderStore.mockImplementation(
      (selector: (state: { folders: Array<{ path: string; status: string }> }) => unknown) =>
        selector({ folders }),
    )
    mockGetState.mockReturnValue({
      selectedFolder,
      applyFolderClick: vi.fn(),
    })
    mockUseMediaMetadataQuery.mockReturnValue({
      data: {
        mediaFolderPath: selectedFolder,
        type: "local-folder",
      },
    })
  }

  it("renders LocalFilePanel when folder status is ok", () => {
    arrange({ folderStatus: "ok" })
    renderApp()

    expect(screen.getByTestId("local-file-panel")).toBeInTheDocument()
    expect(screen.getByText("/media/local-folder")).toBeInTheDocument()
  })

  it("renders LocalFilePanel when folder status is error_loading_metadata", () => {
    arrange({ folderStatus: "error_loading_metadata" })
    renderApp()

    expect(screen.getByTestId("local-file-panel")).toBeInTheDocument()
  })

  it("does not render LocalFilePanel when folder status is loading", () => {
    arrange({ folderStatus: "loading" })
    renderApp()

    expect(screen.queryByTestId("local-file-panel")).not.toBeInTheDocument()
  })

  it("persists selected folder to localStorage without backend config write", () => {
    arrange({ folderStatus: "ok" })
    renderApp()

    expect(mockLocalStorages.sidebarSelectedFolder).toBe("/media/local-folder")
    expect(mockSetAndSaveUserConfig).not.toHaveBeenCalled()
  })
})
