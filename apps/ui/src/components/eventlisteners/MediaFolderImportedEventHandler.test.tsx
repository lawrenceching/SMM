import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, act } from "@testing-library/react"
import { useEffect } from "react"
import { MediaFolderImportedEventHandler } from "./MediaFolderImportedEventHandler"
import { UI_MediaFolderImportedEvent } from "@/types/eventTypes"

const mockInitializeImportedMediaFolder = vi.fn()

vi.mock("@/hooks/initialization/useInitializeImportedMediaFolder", () => ({
  useInitializeImportedMediaFolder: () => ({
    initializeImportedMediaFolder: mockInitializeImportedMediaFolder,
  }),
}))

vi.mock("react-use", () => ({
  useMount: (cb: () => void) => {
    useEffect(cb, [])
  },
  useUnmount: (cb: () => void) => {
    useEffect(() => cb, [])
  },
}))

vi.mock("es-toolkit", () => ({
  Mutex: class Mutex {
    async acquire() {}
    release() {}
  },
}))

describe("MediaFolderImportedEventHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInitializeImportedMediaFolder.mockResolvedValue(undefined)
  })

  it("invokes initializeImportedMediaFolder when import event is dispatched", async () => {
    render(<MediaFolderImportedEventHandler />)

    const detail = {
      type: "tvshow" as const,
      folderPathInPlatformFormat: "C:\\TVShows\\TestShow",
      traceId: "test-trace-id",
    }
    const event = new CustomEvent(UI_MediaFolderImportedEvent, { detail })

    document.dispatchEvent(event)

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(mockInitializeImportedMediaFolder).toHaveBeenCalledTimes(1)
    expect(mockInitializeImportedMediaFolder).toHaveBeenCalledWith(event)
  })

  it("calls detail.onCompleted after initializer resolves", async () => {
    const onCompleted = vi.fn()
    render(<MediaFolderImportedEventHandler />)

    const event = new CustomEvent(UI_MediaFolderImportedEvent, {
      detail: {
        type: "music" as const,
        folderPathInPlatformFormat: "C:\\Music\\TestFolder",
        traceId: "test-trace-id",
        onCompleted,
      },
    })

    document.dispatchEvent(event)

    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })

    expect(onCompleted).toHaveBeenCalledTimes(1)
  })

  it("calls detail.onCompleted when initializer rejects", async () => {
    const onCompleted = vi.fn()
    mockInitializeImportedMediaFolder.mockRejectedValue(new Error("init failed"))

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    render(<MediaFolderImportedEventHandler />)

    const event = new CustomEvent(UI_MediaFolderImportedEvent, {
      detail: {
        type: "tvshow" as const,
        folderPathInPlatformFormat: "C:\\TVShows\\Fail",
        traceId: "test-trace-id",
        onCompleted,
      },
    })

    document.dispatchEvent(event)

    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })

    expect(onCompleted).toHaveBeenCalledTimes(1)
    consoleError.mockRestore()
  })
})
