import { describe, it, expect, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"
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

vi.mock("@/providers/media-metadata-provider", () => ({
  useMediaMetadata: vi.fn(),
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
import { useMediaMetadata } from "@/providers/media-metadata-provider"
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore"
import { initializeMusicFolder } from "@/lib/initializeMusicFolder"
import { createInitialMediaMetadata } from "@/lib/mediaMetadataUtils"
import { doPreprocessMediaFolder } from "@/AppV2Utils"
import { readMediaMetadataApi } from "@/api/readMediaMatadata"

const mockUseConfig = useConfig as any
const mockUseMediaMetadata = useMediaMetadata as any
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

    mockUseMediaMetadata.mockReturnValue({
      addMediaMetadata: (metadata: any) => {
        testMediaMetadatas.push(metadata)
        sharedRef.current = testMediaMetadatas
      },
      updateMediaMetadata: vi.fn(),
      getMediaMetadata: vi.fn(() => undefined),
      setSelectedMediaMetadata: (index: number) => {
        mockSetSelectedMediaMetadata(index)
      },
      mediaMetadatas: testMediaMetadatas,
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

    expect(mockSetSelectedMediaMetadata).toHaveBeenCalledWith(0)
  })

  it("calls setSelectedMediaMetadata after importing tvshow folder", async () => {
    const mockCreateInitialMediaMetadata = createInitialMediaMetadata as ReturnType<typeof vi.fn>
    const mockDoPreprocessMediaFolder = doPreprocessMediaFolder as ReturnType<typeof vi.fn>
    const mockReadMediaMetadataApi = readMediaMetadataApi as ReturnType<typeof vi.fn>

    mockCreateInitialMediaMetadata.mockResolvedValue({
      mediaFolderPath: "c:/TVShows/TestShow",
      type: "tvshow-folder",
      status: "initializing",
    })

    mockReadMediaMetadataApi.mockResolvedValue({
      data: null,
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

    expect(mockSetSelectedMediaMetadata).toHaveBeenCalledWith(0)
  })

  it("calls setSelectedMediaMetadata after importing movie folder", async () => {
    const mockCreateInitialMediaMetadata = createInitialMediaMetadata as ReturnType<typeof vi.fn>
    const mockDoPreprocessMediaFolder = doPreprocessMediaFolder as ReturnType<typeof vi.fn>
    const mockReadMediaMetadataApi = readMediaMetadataApi as ReturnType<typeof vi.fn>

    mockCreateInitialMediaMetadata.mockResolvedValue({
      mediaFolderPath: "c:/Movies/TestMovie",
      type: "movie-folder",
      status: "initializing",
    })

    mockReadMediaMetadataApi.mockResolvedValue({
      data: null,
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

    expect(mockSetSelectedMediaMetadata).toHaveBeenCalledWith(0)
  })
})
