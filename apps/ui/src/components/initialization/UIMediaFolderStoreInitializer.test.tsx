import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { UIMediaFolderStoreInitializer } from "./UIMediaFolderStoreInitializer"
import { useConfig } from "@/hooks/userConfig"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"

vi.mock("@/hooks/userConfig", () => ({
  useConfig: vi.fn(),
}))

const { mockSetFolders } = vi.hoisted(() => ({
  mockSetFolders: vi.fn(),
}))

vi.mock("@/stores/uiMediaFolderStore", () => ({
  useUIMediaFolderStore: vi.fn((selector: (s: { setFolders: typeof mockSetFolders }) => unknown) =>
    selector({ setFolders: mockSetFolders }),
  ),
}))

const mockUseConfig = useConfig as unknown as ReturnType<typeof vi.fn>
const mockUseUIMediaFolderStore = useUIMediaFolderStore as unknown as ReturnType<typeof vi.fn>

describe("UIMediaFolderStoreInitializer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseUIMediaFolderStore.mockImplementation((selector) =>
      selector({ setFolders: mockSetFolders }),
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
  })

  it("initializes folders only once after config is loaded", () => {
    mockUseConfig.mockReturnValue({
      userConfig: { folders: ["C:/Movies/A", "C:/Shows/B"] },
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
  })
})
