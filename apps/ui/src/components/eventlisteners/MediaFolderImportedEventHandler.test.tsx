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

vi.mock("@/stores/mediaMetadataStore", () => ({
  useMediaMetadataStoreActions: vi.fn(),
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
import { createInitialMediaMetadata } from "@/lib/mediaMetadataUtils"
import { doPreprocessMediaFolder } from "@/AppV2Utils"
import { readMediaMetadataApi } from "@/api/readMediaMatadata"

const mockUseConfig = useConfig as any
const mockUseMediaMetadataStoreActions = useMediaMetadataStoreActions as any
const mockUseMediaMetadataActions = useMediaMetadataActions as any
const mockUseBackgroundJobsStore = useBackgroundJobsStore as any

describe("MediaFolderImportedEventHandler", () => {
  let mockSetSelectedMediaMetadata: any
  let testMediaMetadatas: any[]

  beforeEach(() => {
    vi.clearAllMocks()

    mockSetSelectedMediaMetadata = vi.fn()
    testMediaMetadatas = []
    sharedRef.current = testMediaMetadatas

    mockUseConfig.mockReturnValue({
      addMediaFolderInUserConfig: vi.fn(),
    } as any)

    mockUseMediaMetadataStoreActions.mockReturnValue({
      getMediaMetadata: vi.fn(() => undefined),
      setSelectedByMediaFolderPath: (path: string) => {
        mockSetSelectedMediaMetadata(path)
      },
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

    await new Promise(resolve => setTimeout(resolve, 1100))

    await act(async () => {
      expect(mockSetSelectedMediaMetadata).toHaveBeenCalledWith("c:/Music/TestFolder")
    })
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
})
