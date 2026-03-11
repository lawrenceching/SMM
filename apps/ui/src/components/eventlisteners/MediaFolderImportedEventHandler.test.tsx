import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, act } from "@testing-library/react"
import { MediaFolderImportedEventHandler } from "./MediaFolderImportedEventHandler"
import { UI_MediaFolderImportedEvent } from "@/types/eventTypes"

const { MockPath } = vi.hoisted(() => {
  class MockPath {
    path: string

    constructor(path: string) {
      this.path = path
    }

    static toPlatformPath(path: string): string {
      return path.replace(/\//g, "\\")
    }

    static posix(path: string): string {
      const p = path.replace(/\\/g, "/")
      return p.charAt(0).toLowerCase() + p.slice(1)
    }

    name(): string {
      return this.path.split(/[\\/]/).pop() || "TestFolder"
    }
  }
  return { MockPath }
})

vi.mock("@core/path", () => ({
  Path: MockPath,
}))

vi.mock("@/providers/config-provider", () => ({
  useConfig: vi.fn(),
}))

const mockGetState = vi.fn()
vi.mock("@/stores/mediaMetadataStore", () => ({
  useMediaMetadataStoreActions: vi.fn(),
  useMediaMetadataStore: {
    getState: () => mockGetState(),
  },
}))

vi.mock("@/actions/mediaMetadataActions", () => ({
  useMediaMetadataActions: vi.fn(),
}))

vi.mock("@/stores/backgroundJobsStore", () => ({
  useBackgroundJobsStore: vi.fn(),
}))

vi.mock("@/lib/utils", () => ({
  nextTraceId: vi.fn(() => "test-trace-id"),
}))

vi.mock("@/lib/initializeMusicFolder", () => ({
  initializeMusicFolder: vi.fn(),
}))

vi.mock("@/lib/mediaMetadataUtils", () => ({
  createInitialMediaMetadata: vi.fn(),
}))

vi.mock("@/AppV2Utils", () => ({
  doPreprocessMediaFolder: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}))

vi.mock("@core/mediaMetadata", () => ({
  createMediaMetadata: vi.fn((path: string, type: string) => {
    const p = path.replace(/\\/g, "/")
    const posix = p.charAt(0).toLowerCase() + p.slice(1)
    return { mediaFolderPath: posix, type }
  }),
}))

vi.mock("@/api/readMediaMatadata", () => ({
  readMediaMetadataApi: vi.fn(),
}))

vi.mock("@/api/listFiles", () => ({
  listFiles: vi.fn(),
}))

vi.mock("es-toolkit", () => ({
  delay: vi.fn((ms: number) => new Promise(resolve => setTimeout(resolve, ms))),
  isNotNil: (val: any) => val != null,
  range: (n: number) => Array.from({ length: n }, (_, i) => i),
  Mutex: class Mutex {
    async acquire() {}
    release() {}
  },
}))

import { useEffect } from "react"

const { sharedRef } = vi.hoisted(() => {
  const ref = { current: [] as any[] }
  return { sharedRef: ref }
})

vi.mock("react-use", () => ({
  useLatest: (val: any) => {
    sharedRef.current = val
    return sharedRef
  },
  useMount: (cb: () => void) => {
    useEffect(cb, [])
  },
  useUnmount: (cb: () => void) => {
    useEffect(() => cb, [])
  },
}))

import { useConfig } from "@/providers/config-provider"
import { useMediaMetadataStoreActions } from "@/stores/mediaMetadataStore"
import { useMediaMetadataActions } from "@/actions/mediaMetadataActions"
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore"
import { initializeMusicFolder } from "@/lib/initializeMusicFolder"
import { doPreprocessMediaFolder } from "@/AppV2Utils"
import { readMediaMetadataApi } from "@/api/readMediaMatadata"
import { toast } from "sonner"

const mockUseConfig = useConfig as any
const mockUseMediaMetadataStoreActions = useMediaMetadataStoreActions as any
const mockUseMediaMetadataActions = useMediaMetadataActions as any
const mockUseBackgroundJobsStore = useBackgroundJobsStore as any

describe("MediaFolderImportedEventHandler", () => {
  let mockSetSelectedMediaMetadata: any
  let mockRemoveMediaMetadata: any
  let testMediaMetadatas: any[]
  let mockStoreState: { mediaMetadatas: any[]; selectedIndex: number; setSelectedByMediaFolderPath: (path: string) => void; removeMediaMetadata: (path: string) => void }

  beforeEach(() => {
    vi.clearAllMocks()

    mockSetSelectedMediaMetadata = vi.fn()
    mockRemoveMediaMetadata = vi.fn()
    testMediaMetadatas = []
    sharedRef.current = testMediaMetadatas

    mockStoreState = {
      mediaMetadatas: [],
      selectedIndex: 0,
      setSelectedByMediaFolderPath: mockSetSelectedMediaMetadata,
      removeMediaMetadata: mockRemoveMediaMetadata,
    }
    mockGetState.mockImplementation(() => mockStoreState)

    mockUseConfig.mockReturnValue({
      addMediaFolderInUserConfig: vi.fn(),
    } as any)

    mockUseMediaMetadataStoreActions.mockReturnValue({
      getMediaMetadata: vi.fn(() => undefined),
      setSelectedByMediaFolderPath: mockSetSelectedMediaMetadata,
      addMediaMetadata: vi.fn((metadata: any) => {
        const idx = mockStoreState.mediaMetadatas.findIndex((m: any) => m.mediaFolderPath === metadata.mediaFolderPath)
        if (idx >= 0) {
          mockStoreState.mediaMetadatas[idx] = metadata
        } else {
          mockStoreState.mediaMetadatas.push(metadata)
          mockStoreState.selectedIndex = mockStoreState.mediaMetadatas.length - 1
        }
      }),
    } as any)

    mockUseMediaMetadataActions.mockReturnValue({
      saveMediaMetadata: (metadata: any) => {
        testMediaMetadatas.push(metadata)
        sharedRef.current = testMediaMetadatas
      },
      updateMediaMetadata: vi.fn(),
      initializeMediaMetadata: vi.fn().mockResolvedValue({
        mediaFolderPath: "c:/placeholder",
        type: "tvshow-folder",
        status: "initializing",
      }),
    } as any)

    mockUseBackgroundJobsStore.mockReturnValue({
      addJob: vi.fn(() => "test-job-id"),
      updateJob: vi.fn(),
      abortJob: vi.fn(),
      getRunningJobs: vi.fn(() => []),
      setPopoverOpen: vi.fn(),
    } as any)
  })

  it("calls setSelectedMediaMetadata after importing music folder", async () => {
    const mockInitializeMusicFolder = initializeMusicFolder as ReturnType<typeof vi.fn>
    
    mockInitializeMusicFolder.mockImplementation(async (_, { addMediaMetadata }: any) => {
      addMediaMetadata({
        mediaFolderPath: "c:/Music/TestFolder",
        status: "ok",
      })
    })

    render(<MediaFolderImportedEventHandler />)

    const eventData = {
      type: "music" as const,
      folderPathInPlatformFormat: "C:\\Music\\TestFolder",
      traceId: "test-trace-id",
    }

    const event = new CustomEvent(UI_MediaFolderImportedEvent, {
      detail: eventData,
    })

    document.dispatchEvent(event)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    expect(mockSetSelectedMediaMetadata).toHaveBeenCalledWith("c:/Music/TestFolder")
  })

  it("calls setSelectedByMediaFolderPath optimistically before async work (tvshow)", async () => {
    const mockDoPreprocessMediaFolder = doPreprocessMediaFolder as ReturnType<typeof vi.fn>
    const callOrder: string[] = []
    mockUseMediaMetadataStoreActions.mockReturnValue({
      getMediaMetadata: vi.fn(() => undefined),
      setSelectedByMediaFolderPath: vi.fn((path: string) => {
        mockSetSelectedMediaMetadata(path)
        callOrder.push("setSelected")
      }),
      addMediaMetadata: vi.fn((metadata: any) => {
        const idx = mockStoreState.mediaMetadatas.findIndex((m: any) => m.mediaFolderPath === metadata.mediaFolderPath)
        if (idx >= 0) mockStoreState.mediaMetadatas[idx] = metadata
        else {
          mockStoreState.mediaMetadatas.push(metadata)
          mockStoreState.selectedIndex = mockStoreState.mediaMetadatas.length - 1
        }
        callOrder.push("addMetadata")
      }),
    } as any)
    mockUseMediaMetadataActions.mockReturnValue({
      saveMediaMetadata: (metadata: any) => {
        testMediaMetadatas.push(metadata)
        sharedRef.current = testMediaMetadatas
      },
      updateMediaMetadata: vi.fn(),
      initializeMediaMetadata: vi.fn().mockImplementation(async () => {
        callOrder.push("initStart")
        await new Promise((r) => setTimeout(r, 30))
        callOrder.push("initEnd")
        return { mediaFolderPath: "c:/TVShows/TestShow", type: "tvshow-folder", status: "initializing" }
      }),
    } as any)
    mockDoPreprocessMediaFolder.mockImplementation(async (_mm: any, { onSuccess }: any) => {
      await new Promise((r) => setTimeout(r, 20))
      onSuccess({ mediaFolderPath: "c:/TVShows/TestShow", type: "tvshow-folder", status: "ok" })
    })

    render(<MediaFolderImportedEventHandler />)
    const event = new CustomEvent(UI_MediaFolderImportedEvent, {
      detail: { type: "tvshow" as const, folderPathInPlatformFormat: "C:\\TVShows\\TestShow", traceId: "test-trace-id" },
    })
    document.dispatchEvent(event)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    const addIdx = callOrder.indexOf("addMetadata")
    const setIdx = callOrder.indexOf("setSelected")
    const initIdx = callOrder.indexOf("initStart")
    expect(addIdx).toBeGreaterThanOrEqual(0)
    expect(setIdx).toBeGreaterThanOrEqual(0)
    expect(initIdx).toBeGreaterThanOrEqual(0)
    expect(setIdx).toBeLessThan(initIdx)
  })

  it("calls setSelectedMediaMetadata after importing tvshow folder", async () => {
    const mockDoPreprocessMediaFolder = doPreprocessMediaFolder as ReturnType<typeof vi.fn>
    const mockReadMediaMetadataApi = readMediaMetadataApi as ReturnType<typeof vi.fn>
    const mockListFiles = (await import("@/api/listFiles")).listFiles as ReturnType<typeof vi.fn>

    mockUseMediaMetadataActions.mockReturnValue({
      saveMediaMetadata: (metadata: any) => {
        testMediaMetadatas.push(metadata)
        sharedRef.current = testMediaMetadatas
      },
      updateMediaMetadata: vi.fn(),
      initializeMediaMetadata: vi.fn().mockResolvedValue({
        mediaFolderPath: "c:/TVShows/TestShow",
        type: "tvshow-folder",
        status: "initializing",
      }),
    } as any)

    mockReadMediaMetadataApi.mockResolvedValue({
      data: null,
    })

    mockListFiles.mockResolvedValue({
      data: {
        items: [
          { path: "C:\\TVShows\\TestShow\\episode1.mp4", isDirectory: false },
        ]
      }
    })

    mockDoPreprocessMediaFolder.mockImplementation(async (mm, { onSuccess }) => {
      await new Promise(resolve => setTimeout(resolve, 50))
      onSuccess({
        ...mm,
        status: "ok",
      })
    })

    render(<MediaFolderImportedEventHandler />)

    const eventData = {
      type: "tvshow" as const,
      folderPathInPlatformFormat: "C:\\TVShows\\TestShow",
      traceId: "test-trace-id",
    }

    const event = new CustomEvent(UI_MediaFolderImportedEvent, {
      detail: eventData,
    })

    document.dispatchEvent(event)

    await new Promise(resolve => setTimeout(resolve, 200))

    await act(async () => {
      expect(mockSetSelectedMediaMetadata).toHaveBeenCalledWith("c:/TVShows/TestShow")
    })
  })

  it("calls setSelectedMediaMetadata after importing movie folder", async () => {
    const mockDoPreprocessMediaFolder = doPreprocessMediaFolder as ReturnType<typeof vi.fn>
    const mockReadMediaMetadataApi = readMediaMetadataApi as ReturnType<typeof vi.fn>
    const mockListFiles = (await import("@/api/listFiles")).listFiles as ReturnType<typeof vi.fn>

    mockUseMediaMetadataActions.mockReturnValue({
      saveMediaMetadata: (metadata: any) => {
        testMediaMetadatas.push(metadata)
        sharedRef.current = testMediaMetadatas
      },
      updateMediaMetadata: vi.fn(),
      initializeMediaMetadata: vi.fn().mockResolvedValue({
        mediaFolderPath: "c:/Movies/TestMovie",
        type: "movie-folder",
        status: "initializing",
      }),
    } as any)

    mockReadMediaMetadataApi.mockResolvedValue({
      data: null,
    })

    mockListFiles.mockResolvedValue({
      data: {
        items: [
          { path: "C:\\Movies\\TestMovie\\movie.mp4", isDirectory: false },
        ]
      }
    })

    mockDoPreprocessMediaFolder.mockImplementation(async (mm, { onSuccess }) => {
      await new Promise(resolve => setTimeout(resolve, 50))
      onSuccess({
        ...mm,
        status: "ok",
      })
    })

    render(<MediaFolderImportedEventHandler />)

    const eventData = {
      type: "movie" as const,
      folderPathInPlatformFormat: "C:\\Movies\\TestMovie",
      traceId: "test-trace-id",
    }

    const event = new CustomEvent(UI_MediaFolderImportedEvent, {
      detail: eventData,
    })

    document.dispatchEvent(event)

    await new Promise(resolve => setTimeout(resolve, 200))

    await act(async () => {
      expect(mockSetSelectedMediaMetadata).toHaveBeenCalledWith("c:/Movies/TestMovie")
    })
  })

  it("rolls back selection and shows toast when initializeMediaMetadata fails (tvshow)", async () => {
    mockStoreState.mediaMetadatas = [{ mediaFolderPath: "/previous/folder", type: "tvshow-folder", status: "ok" }]
    mockStoreState.selectedIndex = 0

    const mockInit = vi.fn().mockRejectedValue(new Error("Init failed"))
    mockUseMediaMetadataActions.mockReturnValue({
      saveMediaMetadata: vi.fn(),
      updateMediaMetadata: vi.fn(),
      initializeMediaMetadata: mockInit,
    } as any)

    render(<MediaFolderImportedEventHandler />)
    const event = new CustomEvent(UI_MediaFolderImportedEvent, {
      detail: { type: "tvshow" as const, folderPathInPlatformFormat: "C:\\TVShows\\FailShow", traceId: "test-trace-id" },
    })
    document.dispatchEvent(event)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150))
    })

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("初始化媒体目录失败"))
    expect(mockSetSelectedMediaMetadata).toHaveBeenLastCalledWith("/previous/folder")
    expect(mockRemoveMediaMetadata).toHaveBeenCalled()
  })

  it("shows toast when music folder initialization fails", async () => {
    const mockInitializeMusicFolder = initializeMusicFolder as ReturnType<typeof vi.fn>
    mockInitializeMusicFolder.mockRejectedValue(new Error("Music init failed"))

    render(<MediaFolderImportedEventHandler />)
    const event = new CustomEvent(UI_MediaFolderImportedEvent, {
      detail: { type: "music" as const, folderPathInPlatformFormat: "C:\\Music\\FailFolder", traceId: "test-trace-id" },
    })
    document.dispatchEvent(event)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("导入音乐目录失败"))
    expect(mockRemoveMediaMetadata).toHaveBeenCalled()
  })
})
