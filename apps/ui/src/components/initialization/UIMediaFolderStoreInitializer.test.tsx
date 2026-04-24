import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { UIMediaFolderStoreInitializer } from "./UIMediaFolderStoreInitializer"
import { useConfig } from "@/hooks/userConfig"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import localStorages from "@/lib/localStorages"

vi.mock("@/hooks/userConfig", () => ({
  useConfig: vi.fn(),
}))

const { mockSetFolders, mockSetSelectedFolder } = vi.hoisted(() => ({
  mockSetFolders: vi.fn(),
  mockSetSelectedFolder: vi.fn(),
}))

vi.mock("@/stores/uiMediaFolderStore", () => ({
  useUIMediaFolderStore: vi.fn((selector: (s: {
    setFolders: typeof mockSetFolders
    setSelectedFolder: typeof mockSetSelectedFolder
  }) => unknown) =>
    selector({
      setFolders: mockSetFolders,
      setSelectedFolder: mockSetSelectedFolder,
    }),
  ),
}))

vi.mock("@/lib/localStorages", () => ({
  default: {
    sidebarSelectedFolder: null,
  },
}))

const mockUseConfig = useConfig as unknown as ReturnType<typeof vi.fn>
const mockUseUIMediaFolderStore = useUIMediaFolderStore as unknown as ReturnType<typeof vi.fn>

describe("UIMediaFolderStoreInitializer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(localStorages as { sidebarSelectedFolder: string | null }).sidebarSelectedFolder = null
    mockUseUIMediaFolderStore.mockImplementation((selector) =>
      selector({
        setFolders: mockSetFolders,
        setSelectedFolder: mockSetSelectedFolder,
      }),
    )
  })

  it("does not initialize when config is still loading", () => {
    mockUseConfig.mockReturnValue({
      userConfig: { folders: ["C:/Movies/A"] },
      isLoading: true,
      isUserConfigLoaded: false,
    })

    render(<UIMediaFolderStoreInitializer />)

    expect(mockSetFolders).not.toHaveBeenCalled()
    expect(mockSetSelectedFolder).not.toHaveBeenCalled()
  })

  it("initializes folders only once after config is loaded", () => {
    ;(localStorages as { sidebarSelectedFolder: string | null }).sidebarSelectedFolder = "C:/Shows/B"
    mockUseConfig.mockReturnValue({
      userConfig: { folders: ["C:/Movies/A", "C:/Shows/B"], selectedFolder: "C:/Shows/B" },
      isLoading: false,
      isUserConfigLoaded: true,
    })

    const { rerender } = render(<UIMediaFolderStoreInitializer />)
    rerender(<UIMediaFolderStoreInitializer />)

    expect(mockSetFolders).toHaveBeenCalledTimes(1)
    expect(mockSetFolders).toHaveBeenCalledWith([
      { path: "C:/Movies/A", status: "ok", test: false },
      { path: "C:/Shows/B", status: "ok", test: false },
    ])
    expect(mockSetSelectedFolder).toHaveBeenCalledTimes(1)
    expect(mockSetSelectedFolder).toHaveBeenCalledWith("C:/Shows/B")
  })

  it("falls back to first folder when persisted selection is missing", () => {
    ;(localStorages as { sidebarSelectedFolder: string | null }).sidebarSelectedFolder = "C:/Missing/NotFound"
    mockUseConfig.mockReturnValue({
      userConfig: {
        folders: ["C:/Movies/A", "C:/Shows/B"],
        selectedFolder: "C:/Missing/NotFound",
      },
      isLoading: false,
      isUserConfigLoaded: true,
    })

    render(<UIMediaFolderStoreInitializer />)

    expect(mockSetSelectedFolder).toHaveBeenCalledTimes(1)
    expect(mockSetSelectedFolder).toHaveBeenCalledWith("C:/Movies/A")
  })

  it("ignores legacy userConfig.selectedFolder when localStorage has no value", () => {
    ;(localStorages as { sidebarSelectedFolder: string | null }).sidebarSelectedFolder = null
    mockUseConfig.mockReturnValue({
      userConfig: {
        folders: ["C:/Movies/A", "C:/Shows/B"],
        selectedFolder: "C:/Shows/B",
      },
      isLoading: false,
      isUserConfigLoaded: true,
    })

    render(<UIMediaFolderStoreInitializer />)

    expect(mockSetSelectedFolder).toHaveBeenCalledTimes(1)
    expect(mockSetSelectedFolder).toHaveBeenCalledWith("C:/Movies/A")
  })
})
