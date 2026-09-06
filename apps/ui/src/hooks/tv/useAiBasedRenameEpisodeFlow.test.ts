import { describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useAiBasedRenameEpisodeFlow } from "./useAiBasedRenameEpisodeFlow"
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan"
import type { MediaMetadata } from "@smm/types"

const h = vi.hoisted(() => ({
  plans: [] as unknown[],
  updatePlanMutateAsync: vi.fn(),
  cleanupRenamePlan: vi.fn(),
}))

vi.mock("@/hooks/plans", () => ({
  usePlansQuery: () => ({ data: h.plans }),
  usePlansPullOnVisible: () => undefined,
  useUpdatePlanMutation: () => ({ mutateAsync: h.updatePlanMutateAsync }),
  toUpdatePlanPatch: (patch: unknown) => patch,
}))

vi.mock("@/stores/uiMediaFolderStore", () => ({
  useUIMediaFolderStore: { getState: () => ({ applyFolderClick: vi.fn() }) },
}))

vi.mock("./useTvShowWebSocketEvents", () => ({
  useTvShowWebSocketEvents: () => undefined,
}))

vi.mock("@/ai/plan/cleanupRenamePlan", () => ({
  cleanupRenamePlan: h.cleanupRenamePlan,
}))

describe("useAiBasedRenameEpisodeFlow", () => {
  const mediaFolderPath = "/storage/Users/currentUser/Download/Anime/show"
  const mediaMetadata = { mediaFolderPath, type: "tvshow-folder" } as MediaMetadata

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
    expect(result.current.promptStatus).toBe("wait-for-ack")
    expect(result.current.promptProps.isOpen).toBe(true)
    expect(result.current.promptProps.status).toBe("wait-for-ack")
  })

  it("maps a preparing plan to the generating prompt status", () => {
    h.plans = [{ ...pendingAiPlan, status: "preparing" }]
    const { result } = renderHook(() =>
      useAiBasedRenameEpisodeFlow({ mediaMetadata }),
    )

    expect(result.current.promptStatus).toBe("generating")
    expect(result.current.promptProps.status).toBe("generating")
  })

  it("ignores plans of other media folders", () => {
    h.plans = [{ ...pendingAiPlan, mediaFolderPath: "/other/show" }]
    const { result } = renderHook(() =>
      useAiBasedRenameEpisodeFlow({ mediaMetadata }),
    )

    expect(result.current.plan).toBeUndefined()
    expect(result.current.promptProps.isOpen).toBe(false)
  })

  it("rejects and cleans up the plan on cancel", async () => {
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
    expect(h.cleanupRenamePlan).toHaveBeenCalledWith("rename-plan-1")
  })
})
