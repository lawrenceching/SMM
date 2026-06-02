/** @vitest-environment jsdom */
/**
 * Integration: TranscribeDialog → JobOrchestrator → executeCmd boundary.
 * Verifies videocaptioner transcribe receives full nested media path.
 */
import type { ReactElement } from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Path } from "@core/path"
import { JobOrchestratorProvider } from "@/components/JobOrchestratorProvider"
import { TranscribeDialog } from "./TranscribeDialog"
import { deleteJob, getAllJobs } from "@/lib/downloadTaskDb"
import type { ExecuteCmdRequest } from "@/api/executeCmd"
import { useFeatures } from "@/hooks/useFeatures"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"
import type { TranscribeDialogRow } from "./types"

const MEDIA_FOLDER_POSIX = "/path/to/music"
const NESTED_FILE_POSIX = "/path/to/music/a/b/c/d/test.mp4"
const NESTED_FILE_REL = "a/b/c/d/test.mp4"
const PLATFORM_FOLDER = Path.toPlatformPath(MEDIA_FOLDER_POSIX)
const EXPECTED_MEDIA_PLATFORM = Path.toPlatformPath(NESTED_FILE_POSIX)

const h = vi.hoisted(() => ({
  executeCmdToCompletion: vi.fn(),
  executeCmdToCompletionWithHeaders: vi.fn(),
}))

vi.mock("@/lib/whitelistedCmd/executeCmdToCompletion", () => ({
  executeCmdToCompletion: h.executeCmdToCompletion,
  executeCmdToCompletionWithHeaders: h.executeCmdToCompletionWithHeaders,
}))

vi.mock("@/lib/commandExecutionStatusPoller", () => ({
  pollCommandExecutionStatusAndReconcile: vi.fn().mockResolvedValue(undefined),
  COMMAND_EXECUTION_STATUS_POLL_MS: 60_000,
}))

vi.mock("@/hooks/useFeatures", () => ({
  useFeatures: vi.fn(),
}))

vi.mock("@/hooks/useVideoCaptionerStatus", () => ({
  useVideoCaptionerStatus: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock("@/lib/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/i18n")>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { ns?: string }) => {
        if (options?.ns === "common") {
          const common: Record<string, string> = { cancel: "Cancel" }
          return common[key] ?? key
        }
        const dialogs: Record<string, string> = {
          "transcribe.defaultTitle": "Transcribe",
          "transcribe.defaultDescription": "Description",
          "transcribe.confirm": "Confirm",
          "transcribe.selectAllAria": "Select all",
          "transcribe.columns.filePath": "File",
          "transcribe.advancedOptions.label": "Advanced options",
          "transcribe.noFiles": "No files",
          "transcribe.asr.label": "ASR engine",
          "transcribe.asr.bijian": "Bijian",
          "transcribe.asr.jianying": "Jianying",
          "transcribe.asr.whisperCpp": "Whisper CPP",
          "transcribe.provider.label": "Provider",
          "transcribe.provider.videoCaptioner": "VideoCaptioner",
          "transcribe.provider.tencentAsr": "Tencent ASR",
          "transcribe.language.label": "Language",
          "transcribe.language.placeholder": "auto",
          "transcribe.wordTimestamps.label": "Word timestamps",
          "transcribe.format.label": "Format",
          "transcribe.format.srt": "SRT",
          "transcribe.format.ass": "ASS",
          "transcribe.format.txt": "TXT",
          "transcribe.format.json": "JSON",
          "transcribe.tencent.baseUrl": "Base URL",
          "transcribe.tencent.apiKey": "API key",
        }
        return dialogs[key] ?? key
      },
    }),
  }
})

function isTranscribeRequest(req: ExecuteCmdRequest): boolean {
  return req.command === "videocaptioner" && req.args[0] === "transcribe"
}

function renderWithOrchestrator(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <JobOrchestratorProvider>{ui}</JobOrchestratorProvider>
    </QueryClientProvider>,
  )
}

async function clearTaskDb() {
  const records = await getAllJobs()
  await Promise.all(records.map((r) => deleteJob(r.id)))
}

function nestedRow(): TranscribeDialogRow {
  return {
    id: NESTED_FILE_POSIX,
    path: NESTED_FILE_POSIX,
    displayPath: NESTED_FILE_REL,
    title: "test",
  }
}

describe("TranscribeDialog executeCmd integration (nested paths)", () => {
  beforeEach(async () => {
    Element.prototype.scrollIntoView = vi.fn()
    vi.clearAllMocks()
    await clearTaskDb()
    window.localStorage.clear()

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

    h.executeCmdToCompletionWithHeaders.mockImplementation(async (request: ExecuteCmdRequest) => {
      if (isTranscribeRequest(request)) {
        return {
          success: true,
          stdout: "",
          stderr: "",
          exitCode: 0,
          executionId: "test-transcribe-exec",
        }
      }
      return {
        success: false,
        stdout: "",
        stderr: `unexpected executeCmdToCompletionWithHeaders: ${request.args.join(" ")}`,
        exitCode: 1,
      }
    })
  })

  afterEach(async () => {
    await clearTaskDb()
    window.localStorage.clear()
  })

  it("passes full nested platform media path to videocaptioner transcribe via executeCmd", async () => {
    const onClose = vi.fn()

    renderWithOrchestrator(
      <TranscribeDialog
        isOpen
        onClose={onClose}
        rows={[nestedRow()]}
        folder={PLATFORM_FOLDER}
      />,
    )

    fireEvent.click(screen.getByTestId("transcribe-dialog-confirm"))

    await waitFor(
      () => {
        expect(h.executeCmdToCompletionWithHeaders).toHaveBeenCalled()
      },
      { timeout: 5000 },
    )

    const transcribeCalls = h.executeCmdToCompletionWithHeaders.mock.calls.filter(([req]) =>
      isTranscribeRequest(req),
    )
    expect(transcribeCalls.length).toBeGreaterThanOrEqual(1)

    const request = transcribeCalls[0]![0]
    expect(request.command).toBe("videocaptioner")
    expect(request.args[0]).toBe("transcribe")
    expect(request.args[1]).toBe(EXPECTED_MEDIA_PLATFORM)
    expect(request.args[1]).toContain("a")
    expect(request.args[1]).toContain("test.mp4")
    expect(request.args[1]).not.toBe("test.mp4")
    expect(onClose).toHaveBeenCalled()
  })
})
