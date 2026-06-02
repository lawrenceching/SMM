/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { Path } from "@core/path"
import {
  getRowSubtitlePipelineState,
  buildRowSubtitleUi,
  useMusicFolderSubtitlePipeline,
} from "./useMusicFolderSubtitlePipeline"
import type { LocalFileTableRowData } from "@/components/MusicFileTable"
import { useFileStatuses } from "@/hooks/useJobOrchestrator"
import { useFeatures } from "@/hooks/useFeatures"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"

const MEDIA_FOLDER_POSIX = "/path/to/music"
const NESTED_FILE_POSIX = "/path/to/music/a/b/c/d/test.mp4"
const NESTED_FILE_REL = "a/b/c/d/test.mp4"
const PLATFORM_FOLDER = Path.toPlatformPath(MEDIA_FOLDER_POSIX)

const emptyFileStatuses = {
  runningPaths: new Set<string>(),
  pendingPaths: new Set<string>(),
  failedPaths: new Set<string>(),
  jobIdsByPath: new Map<string, string[]>(),
  primaryJobIdByPath: new Map<string, string>(),
}

vi.mock("@/hooks/useJobManager", () => ({
  useJobManager: () => ({
    stopJob: vi.fn(),
  }),
}))

vi.mock("@/hooks/useJobOrchestrator", () => ({
  useFileStatuses: vi.fn(),
}))

vi.mock("@/hooks/useFeatures", () => ({
  useFeatures: vi.fn(),
}))

vi.mock("@/hooks/useVideoCaptionerStatus", () => ({
  useVideoCaptionerStatus: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

const row: LocalFileTableRowData = {
  kind: "local",
  id: 1,
  index: 0,
  path: "/music/song.mp3",
  title: "Song",
  artist: "Artist",
  duration: 60,
}

const emptySets = {
  transcribing: new Set<string>(),
  transcribeFailed: new Set<string>(),
  translating: new Set<string>(),
  translateFailed: new Set<string>(),
  synthesizing: new Set<string>(),
  synthesizeFailed: new Set<string>(),
  processing: new Set<string>(),
  processFailed: new Set<string>(),
}

describe("getRowSubtitlePipelineState", () => {
  it("marks transcribe running when path is in transcribing set", () => {
    const state = getRowSubtitlePipelineState(
      row,
      "/music",
      new Set(["/music/song.mp3"]),
      emptySets.transcribeFailed,
      emptySets.translating,
      emptySets.translateFailed,
      emptySets.synthesizing,
      emptySets.synthesizeFailed,
      emptySets.processing,
      emptySets.processFailed,
      new Map(),
      new Map(),
      true,
    )
    expect(state.transcribeStatus).toBe("running")
  })

  it("sets canTranslate from eligibility map", () => {
    const state = getRowSubtitlePipelineState(
      row,
      "/music",
      emptySets.transcribing,
      emptySets.transcribeFailed,
      emptySets.translating,
      emptySets.translateFailed,
      emptySets.synthesizing,
      emptySets.synthesizeFailed,
      emptySets.processing,
      emptySets.processFailed,
      new Map([["/music/song.mp3", true]]),
      new Map(),
      true,
    )
    expect(state.canTranslate).toBe(true)
  })
})

describe("buildRowSubtitleUi", () => {
  const t = (key: string) => key

  it("uses spinner index column when transcribing", () => {
    const ui = buildRowSubtitleUi(
      row,
      {
        transcribeStatus: "running",
        canTranslate: false,
        canSynthesize: false,
        canProcess: true,
      },
      false,
      false,
      true,
      true,
      true,
      true,
      t,
    )
    expect(ui.indexColumnVariant).toBe("spinner")
    expect(ui.indexColumnTooltip).toBe("mediaPlayer.transcribingTooltip")
  })
})

function nestedLocalRow(
  path: string,
  overrides?: Partial<LocalFileTableRowData>,
): LocalFileTableRowData {
  return {
    kind: "local",
    id: 1,
    index: 0,
    path,
    title: "test",
    artist: "Artist",
    duration: 120,
    ...overrides,
  }
}

describe("useMusicFolderSubtitlePipeline nested paths", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useFileStatuses).mockReturnValue(emptyFileStatuses)
    vi.mocked(useVideoCaptionerStatus).mockReturnValue({
      isAvailable: true,
      isChecking: false,
    })
    vi.mocked(useFeatures).mockReturnValue({
      isTranscribeEnabled: true,
      isVideoCaptionerAsrOptionsEnabled: false,
      setVideoCaptionerAsrOptionsEnabled: vi.fn(),
      isTencentAsrTranscribeEnabled: false,
      setTencentAsrTranscribeEnabled: vi.fn(),
    })
  })

  it("builds transcribe dialog rows with deeply nested absolute path", () => {
    const { result } = renderHook(() =>
      useMusicFolderSubtitlePipeline({
        platformFolder: PLATFORM_FOLDER,
        mediaFolderPath: MEDIA_FOLDER_POSIX,
        folderFiles: [NESTED_FILE_POSIX],
        localRows: [nestedLocalRow(NESTED_FILE_POSIX)],
        selectedLocalRows: [],
      }),
    )

    expect(result.current.dialogProps.transcribe.rows).toHaveLength(1)
    expect(result.current.dialogProps.transcribe.rows[0]!.path).toBe(NESTED_FILE_POSIX)
    expect(result.current.dialogProps.transcribe.rows[0]!.displayPath).toBe(NESTED_FILE_REL)
  })

  it("resolves relative nested path when building transcribe dialog rows", () => {
    const { result } = renderHook(() =>
      useMusicFolderSubtitlePipeline({
        platformFolder: PLATFORM_FOLDER,
        mediaFolderPath: MEDIA_FOLDER_POSIX,
        folderFiles: [NESTED_FILE_POSIX],
        localRows: [nestedLocalRow(NESTED_FILE_REL)],
        selectedLocalRows: [],
      }),
    )

    expect(result.current.dialogProps.transcribe.rows[0]!.path).toBe(NESTED_FILE_POSIX)
  })

  it("selects nested absolute path when row onTranscribe is triggered", () => {
    const row = nestedLocalRow(NESTED_FILE_POSIX)
    const { result } = renderHook(() =>
      useMusicFolderSubtitlePipeline({
        platformFolder: PLATFORM_FOLDER,
        mediaFolderPath: MEDIA_FOLDER_POSIX,
        folderFiles: [NESTED_FILE_POSIX],
        localRows: [row],
        selectedLocalRows: [],
      }),
    )

    act(() => {
      result.current.bindRowActions(row).onTranscribe()
    })

    expect(result.current.dialogProps.transcribe.isOpen).toBe(true)
    expect(result.current.dialogProps.transcribe.defaultSelectedIds).toEqual([NESTED_FILE_POSIX])
  })
})
