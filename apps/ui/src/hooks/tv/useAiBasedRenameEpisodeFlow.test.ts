import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useAiBasedRenameEpisodeFlow } from "./useAiBasedRenameEpisodeFlow"
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan"
import type { MediaMetadata } from "@smm/types"

const h = vi.hoisted(() => ({
  plans: [] as unknown[],
  updatePlanMutateAsync: vi.fn(),
  applyPlanMutateAsync: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { error: h.toastError, success: vi.fn() },
}))

vi.mock("@/hooks/plans", () => ({
  usePlansQuery: () => ({ data: h.plans }),
  usePlansPullOnVisible: () => undefined,
  useUpdatePlanMutation: () => ({ mutateAsync: h.updatePlanMutateAsync }),
  useApplyPlanMutation: () => ({ mutateAsync: h.applyPlanMutateAsync }),
  toUpdatePlanPatch: (patch: unknown) => patch,
}))

vi.mock("@/stores/uiMediaFolderStore", () => ({
  useUIMediaFolderStore: { getState: () => ({ applyFolderClick: vi.fn() }) },
}))

vi.mock("./useTvShowWebSocketEvents", () => ({
  useTvShowWebSocketEvents: () => undefined,
}))

describe("useAiBasedRenameEpisodeFlow", () => {
  const mediaFolderPath = "/storage/Users/currentUser/Download/Anime/show"
  const mediaMetadata = { mediaFolderPath, type: "tvshow-folder" } as MediaMetadata

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const pendingAiPlan: UIRenameFilesPlan = {
    id: "rename-plan-1",
    task: "rename-files",
    status: "pending",
    creator: "ai",
    mediaFolderPath,
    files: [
      { from: `${mediaFolderPath}/old.mkv`, to: `${mediaFolderPath}/new.mkv` },
    ],
  } as unknown as UIRenameFilesPlan

  it("surfaces a pending AI rename plan and opens the prompt", () => {
    h.plans = [pendingAiPlan]
    const { result } = renderHook(() =>
      useAiBasedRenameEpisodeFlow({ mediaMetadata }),
    )

    expect(result.current.plan?.id).toBe("rename-plan-1")
    expect(result.current.promptStatus).toBeUndefined()
    expect(result.current.promptProps.isOpen).toBe(true)
    expect(result.current.promptProps).not.toHaveProperty("status")
  })

  it("ignores plans of other media folders", () => {
    h.plans = [{ ...pendingAiPlan, mediaFolderPath: "/other/show" }]
    const { result } = renderHook(() =>
      useAiBasedRenameEpisodeFlow({ mediaMetadata }),
    )

    expect(result.current.plan).toBeUndefined()
    expect(result.current.promptProps.isOpen).toBe(false)
  })

  it("rejects the plan on cancel", async () => {
    h.plans = [pendingAiPlan]
    const { result } = renderHook(() =>
      useAiBasedRenameEpisodeFlow({ mediaMetadata }),
    )

    await result.current.onCancel()

    expect(h.updatePlanMutateAsync).toHaveBeenCalledWith({
      id: "rename-plan-1",
      mediaFolderPath,
      patch: { status: "rejected" },
    })
  })

  it("applies the full plan on confirm", async () => {
    h.plans = [pendingAiPlan]
    const { result } = renderHook(() =>
      useAiBasedRenameEpisodeFlow({ mediaMetadata }),
    )

    await result.current.onConfirm()

    expect(h.applyPlanMutateAsync).toHaveBeenCalledWith({
      id: "rename-plan-1",
      mediaFolderPath,
    })
  })

  it("shows a toast and keeps the plan when apply fails", async () => {
    h.plans = [pendingAiPlan]
    h.applyPlanMutateAsync.mockRejectedValueOnce(new Error("disk locked"))
    const { result } = renderHook(() =>
      useAiBasedRenameEpisodeFlow({ mediaMetadata }),
    )

    await result.current.onConfirm()

    expect(h.toastError).toHaveBeenCalledWith(
      expect.stringContaining("Failed to apply rename plan"),
    )
  })
})
