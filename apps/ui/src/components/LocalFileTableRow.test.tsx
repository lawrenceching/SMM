/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { Path } from "@core/path"
import { join } from "@/lib/path"
import { LocalFileTableRow } from "./LocalFileTableRow"
import { readFile } from "@/api/readFile"
import { summarizeVideo } from "@/lib/summarizeVideo"
import { findAndWriteSummaryFile } from "@/lib/summarizeFilename"
import { useGetAssociatedFiles } from "@/hooks/useGetAssociatedFiles"
import { useConfig } from "@/hooks/userConfig/useConfig"
import type { LocalFileTableRowData } from "./MusicFileTable"

const MEDIA_FOLDER_POSIX = "/path/to/music"
const NESTED_FILE_POSIX = "/path/to/music/a/b/c/d/test.mp4"
const NESTED_SUBTITLE_POSIX = "/path/to/music/a/b/c/d/test.srt"
const NESTED_SUBTITLE_PLATFORM = Path.toPlatformPath(NESTED_SUBTITLE_POSIX)
const NESTED_FILE_PLATFORM = Path.toPlatformPath(NESTED_FILE_POSIX)
const EXPECTED_SUMMARY_PATH = join(
  Path.toPlatformPath("/path/to/music/a/b/c/d"),
  "test_summary.txt",
)

vi.mock("./UILocalFileTableRow", () => ({
  UILocalFileTableRow: ({ onSummarize }: { onSummarize?: () => void }) => (
    <button type="button" data-testid="summarize-trigger" onClick={() => onSummarize?.()}>
      Summarize
    </button>
  ),
}))

vi.mock("./LocalFileSubtitleScope", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./LocalFileSubtitleScope")>()
  return {
    ...actual,
    useLocalFileSubtitle: () => actual.createMockLocalFileSubtitleContext(),
  }
})

vi.mock("@/hooks/useGetAssociatedFiles", () => ({
  useGetAssociatedFiles: vi.fn(),
}))

vi.mock("@/hooks/userConfig/useConfig", () => ({
  useConfig: vi.fn(),
}))

vi.mock("@/api/readFile", () => ({
  readFile: vi.fn(),
}))

vi.mock("@/lib/summarizeVideo", () => ({
  summarizeVideo: vi.fn(),
}))

vi.mock("@/lib/summarizeFilename", () => ({
  findAndWriteSummaryFile: vi.fn(),
}))

vi.mock("@/stores/backgroundJobsStore", () => ({
  useBackgroundJobsStore: (selector: (s: { jobs: unknown[] }) => unknown) =>
    selector({ jobs: [] }),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  castTranslationFn: (fn: (key: string) => string) => fn,
}))

const nestedRow: LocalFileTableRowData = {
  kind: "local",
  id: 1,
  index: 0,
  path: NESTED_FILE_POSIX,
  title: "test",
  artist: "Artist",
  duration: 120,
}

const defaultSelection = {
  isMultiSelectMode: false,
  selectedTrackIds: [] as number[],
}

describe("LocalFileTableRow summarize nested paths", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useGetAssociatedFiles).mockReturnValue([
      { type: "subtitle", path: NESTED_SUBTITLE_POSIX },
    ])

    vi.mocked(useConfig).mockReturnValue({
      appConfig: { reverseProxyUrl: "http://proxy.test" },
      userConfig: {
        selectedAIProvider: "default",
        aiProviders: [
          {
            name: "default",
            baseURL: "https://api.example",
            model: "model-1",
            apiKey: "key",
          },
        ],
      },
      setUserConfig: vi.fn(),
      isLoading: false,
      isUserConfigLoaded: true,
      error: null,
      setAndSaveUserConfig: vi.fn(),
      reload: vi.fn(),
      refreshUserConfig: vi.fn(),
      addMediaFolderInUserConfig: vi.fn(),
    } as ReturnType<typeof useConfig>)

    vi.mocked(readFile).mockResolvedValue({
      data: "subtitle content",
      error: undefined,
    })
    vi.mocked(summarizeVideo).mockResolvedValue("summary text")
    vi.mocked(findAndWriteSummaryFile).mockResolvedValue(EXPECTED_SUMMARY_PATH)
  })

  it("reads nested subtitle and writes summary beside nested video using platform paths", async () => {
    render(
      <LocalFileTableRow
        row={nestedRow}
        mediaFolderPath={MEDIA_FOLDER_POSIX}
        selection={defaultSelection}
        fileMenu={{}}
      />,
    )

    fireEvent.click(screen.getByTestId("summarize-trigger"))

    await waitFor(() => {
      expect(readFile).toHaveBeenCalledWith(NESTED_SUBTITLE_PLATFORM)
    })
    expect(summarizeVideo).toHaveBeenCalledWith(
      expect.objectContaining({ subtitleContent: "subtitle content" }),
    )
    expect(findAndWriteSummaryFile).toHaveBeenCalledWith(
      NESTED_FILE_PLATFORM,
      "summary text",
    )
    expect(findAndWriteSummaryFile).toHaveBeenCalledWith(
      expect.stringContaining("test.mp4"),
      "summary text",
    )
    expect(findAndWriteSummaryFile.mock.calls[0]![0]).not.toBe("test.mp4")
  })

  it("resolves relative nested row path for summarize", async () => {
    const relRow: LocalFileTableRowData = {
      ...nestedRow,
      path: "a/b/c/d/test.mp4",
    }

    render(
      <LocalFileTableRow
        row={relRow}
        mediaFolderPath={MEDIA_FOLDER_POSIX}
        selection={defaultSelection}
        fileMenu={{}}
      />,
    )

    fireEvent.click(screen.getByTestId("summarize-trigger"))

    await waitFor(() => {
      expect(findAndWriteSummaryFile).toHaveBeenCalledWith(
        NESTED_FILE_PLATFORM,
        "summary text",
      )
    })
  })
})
