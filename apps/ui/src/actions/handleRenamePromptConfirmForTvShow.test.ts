import { describe, it, expect, vi, beforeEach } from "vitest"
import { toast } from "sonner"
import {
  handleRenamePromptConfirmForTvShow,
  type SetPlanByIdFn,
} from "./handleRenamePromptConfirmForTvShow"
import { applyRenameFilesPlanForTvShow } from "@/actions/applyRenameFilesPlanForTvShow"
import { savePlan } from "@/actions/planActions"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan"
import type { PersistUIMediaMetadataFn } from "@/types/persistUIMediaMetadata"

vi.mock("@/actions/applyRenameFilesPlanForTvShow", () => ({
  applyRenameFilesPlanForTvShow: vi.fn(),
}))

vi.mock("@/actions/planActions", () => ({
  savePlan: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe("handleRenamePromptConfirmForTvShow", () => {
  const mediaFolderPath = "/media/show"
  const planId = "plan-1"

  const plan: UIRenameFilesPlan = {
    id: planId,
    task: "rename-files",
    status: "pending",
    mediaFolderPath,
    tmp: true,
    files: [{ from: "/media/show/1.mkv", to: "/media/show/S01E01.mkv" }],
  }

  const mediaMetadata: UIMediaMetadata = {
    mediaFolderPath,
    type: "tvshow-folder",
    status: "ok",
    files: ["/media/show/1.mkv"],
    mediaFiles: [],
  } as UIMediaMetadata

  let setPlanById: ReturnType<typeof vi.fn>
  let persistUiMediaMetadata: ReturnType<typeof vi.fn>
  let renameFilesApi: ReturnType<typeof vi.fn>
  let cleanupRenamePlan: ReturnType<typeof vi.fn>

  const renameFailedLabel = "Failed to rename file"
  const noMediaPathErrorLabel = "No media folder path available"

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(applyRenameFilesPlanForTvShow).mockResolvedValue({
      renameList: [{ from: "/media/show/1.mkv", to: "/media/show/S01E01.mkv" }],
    })
    setPlanById = vi.fn()
    persistUiMediaMetadata = vi.fn().mockResolvedValue(undefined)
    renameFilesApi = vi.fn()
    cleanupRenamePlan = vi.fn().mockResolvedValue(undefined)
  })

  function runHandler(
    overrides: {
      plan?: UIRenameFilesPlan
      mediaMetadata?: UIMediaMetadata
      selectedEpisodePaths?: string[]
    } = {},
  ) {
    return handleRenamePromptConfirmForTvShow(
      {
        planId,
        plan: overrides.plan ?? plan,
        mediaMetadata: overrides.mediaMetadata ?? mediaMetadata,
        selectedEpisodePaths: overrides.selectedEpisodePaths ?? ["/media/show/1.mkv"],
        renameFailedLabel,
        noMediaPathErrorLabel,
      },
      {
        setPlanById: setPlanById as SetPlanByIdFn,
        persistUiMediaMetadata: persistUiMediaMetadata as PersistUIMediaMetadataFn,
        renameFilesApi,
        cleanupRenamePlan,
      },
    )
  }

  it("completes tmp plan and cleans up on success", async () => {
    await runHandler()

    expect(setPlanById).toHaveBeenCalledWith(planId, { status: "loading" })
    expect(applyRenameFilesPlanForTvShow).toHaveBeenCalledTimes(1)
    expect(persistUiMediaMetadata).toHaveBeenCalledTimes(1)
    expect(setPlanById).toHaveBeenCalledWith(planId, { status: "completed" })
    expect(cleanupRenamePlan).toHaveBeenCalledWith(planId)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("calls savePlan for non-tmp plan on success", async () => {
    const persistedPlan: UIRenameFilesPlan = { ...plan, tmp: false }

    await runHandler({ plan: persistedPlan })

    expect(savePlan).toHaveBeenCalledTimes(1)
    expect(cleanupRenamePlan).not.toHaveBeenCalled()
  })

  it("shows toast.error and restores plan status when rename API fails", async () => {
    vi.mocked(applyRenameFilesPlanForTvShow).mockRejectedValue(
      new Error("/api/renameFiles API error: target file already exists"),
    )

    await runHandler()

    expect(persistUiMediaMetadata).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(
      `${renameFailedLabel}: /api/renameFiles API error: target file already exists`,
    )
    expect(setPlanById).toHaveBeenCalledWith(planId, { status: "pending" })
    expect(setPlanById).not.toHaveBeenCalledWith(planId, { status: "completed" })
    expect(cleanupRenamePlan).not.toHaveBeenCalled()
  })

  it("shows toast.error when media folder path is missing", async () => {
    const metadataWithoutPath = {
      ...mediaMetadata,
      mediaFolderPath: undefined,
    } as UIMediaMetadata

    await runHandler({ mediaMetadata: metadataWithoutPath })

    expect(applyRenameFilesPlanForTvShow).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(noMediaPathErrorLabel)
    expect(setPlanById).not.toHaveBeenCalled()
  })
})
