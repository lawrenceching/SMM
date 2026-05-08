import { Path } from "@core/path"
import React from "react"
import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { isFolderAvailable } from "@/api/isFolderAvailable"
import { UIMediaFolderStoreInitializer } from "./UIMediaFolderStoreInitializer"
import { useConfig } from "@/hooks/userConfig"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import localStorages from "@/lib/localStorages"

vi.mock("@/api/isFolderAvailable", () => ({
  isFolderAvailable: vi.fn(),
}))

vi.mock("@/hooks/userConfig", () => ({
  useConfig: vi.fn(),
}))

vi.mock("@/hooks/initialization/useRecheckSelectedFolderAvailability", () => ({
  useRecheckSelectedFolderAvailability: vi.fn(),
}))

const { mockSetFolders, mockSetSelectedFolder, mockUpdateFolderStatus } = vi.hoisted(() => ({
  mockSetFolders: vi.fn(),
  mockSetSelectedFolder: vi.fn(),
  mockUpdateFolderStatus: vi.fn(),
}))

vi.mock("@/stores/uiMediaFolderStore", () => ({
  useUIMediaFolderStore: vi.fn(
    (
      selector: (s: {
        setFolders: typeof mockSetFolders
        setSelectedFolder: typeof mockSetSelectedFolder
        updateFolderStatus: typeof mockUpdateFolderStatus
      }) => unknown,
    ) =>
      selector({
        setFolders: mockSetFolders,
        setSelectedFolder: mockSetSelectedFolder,
        updateFolderStatus: mockUpdateFolderStatus,
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
const mockIsFolderAvailable = vi.mocked(isFolderAvailable)

describe("UIMediaFolderStoreInitializer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(localStorages as { sidebarSelectedFolder: string | null }).sidebarSelectedFolder = null
    mockIsFolderAvailable.mockResolvedValue(true)
    mockUseUIMediaFolderStore.mockImplementation((selector) =>
      selector({
        setFolders: mockSetFolders,
        setSelectedFolder: mockSetSelectedFolder,
        updateFolderStatus: mockUpdateFolderStatus,
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
    expect(mockIsFolderAvailable).not.toHaveBeenCalled()
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
      { path: Path.toPlatformPath("C:/Movies/A"), status: "ok", test: false },
      { path: Path.toPlatformPath("C:/Shows/B"), status: "ok", test: false },
    ])
    expect(mockSetSelectedFolder).toHaveBeenCalledTimes(1)
    expect(mockSetSelectedFolder).toHaveBeenCalledWith(Path.toPlatformPath("C:/Shows/B"))
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
    expect(mockSetSelectedFolder).toHaveBeenCalledWith(Path.toPlatformPath("C:/Movies/A"))
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
    expect(mockSetSelectedFolder).toHaveBeenCalledWith(Path.toPlatformPath("C:/Movies/A"))
  })

  it("calls isFolderAvailable once per configured folder after init", async () => {
    mockUseConfig.mockReturnValue({
      userConfig: { folders: ["C:/Movies/A", "C:/Shows/B"] },
      isLoading: false,
      isUserConfigLoaded: true,
    })

    render(<UIMediaFolderStoreInitializer />)

    await waitFor(() => {
      expect(mockIsFolderAvailable).toHaveBeenCalledTimes(2)
    })
    expect(mockIsFolderAvailable).toHaveBeenCalledWith(Path.toPlatformPath("C:/Movies/A"))
    expect(mockIsFolderAvailable).toHaveBeenCalledWith(Path.toPlatformPath("C:/Shows/B"))
  })

  it("sets folder_not_found when isFolderAvailable returns false", async () => {
    const missingPath = Path.toPlatformPath("C:/Missing/X")
    mockUseConfig.mockReturnValue({
      userConfig: { folders: ["C:/Movies/A", "C:/Missing/X"] },
      isLoading: false,
      isUserConfigLoaded: true,
    })

    mockIsFolderAvailable.mockImplementation(async (p: string) => p === missingPath ? false : true)

    render(<UIMediaFolderStoreInitializer />)

    await waitFor(() => {
      expect(mockUpdateFolderStatus).toHaveBeenCalledWith(missingPath, "folder_not_found")
    })
    expect(mockUpdateFolderStatus).toHaveBeenCalledTimes(1)
  })

  it("does not call updateFolderStatus when every folder is available", async () => {
    mockUseConfig.mockReturnValue({
      userConfig: { folders: ["C:/Movies/A", "C:/Shows/B"] },
      isLoading: false,
      isUserConfigLoaded: true,
    })
    mockIsFolderAvailable.mockResolvedValue(true)

    render(<UIMediaFolderStoreInitializer />)

    await waitFor(() => {
      expect(mockIsFolderAvailable).toHaveBeenCalled()
    })
    expect(mockUpdateFolderStatus).not.toHaveBeenCalled()
  })

  it("does not call updateFolderStatus when isFolderAvailable throws", async () => {
    mockUseConfig.mockReturnValue({
      userConfig: { folders: ["C:/Movies/A"] },
      isLoading: false,
      isUserConfigLoaded: true,
    })
    mockIsFolderAvailable.mockRejectedValue(new Error("network"))

    render(<UIMediaFolderStoreInitializer />)

    await waitFor(() => {
      expect(mockIsFolderAvailable).toHaveBeenCalled()
    })
    expect(mockUpdateFolderStatus).not.toHaveBeenCalled()
  })
})
