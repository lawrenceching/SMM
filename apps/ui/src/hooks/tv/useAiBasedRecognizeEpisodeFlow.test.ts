import { describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useAiBasedRecognizeEpisodeFlow } from "./useAiBasedRecognizeEpisodeFlow"
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan"
import type { MediaMetadata } from "@smm/types"

const h = vi.hoisted(() => ({
  plans: [] as unknown[],
  updatePlanMutateAsync: vi.fn(),
  handleAiRecognizeConfirm: vi.fn(),
}))

vi.mock("@/hooks/plans", () => ({
  usePlansQuery: () => ({ data: h.plans }),
  useUpdatePlanMutation: () => ({ mutateAsync: h.updatePlanMutateAsync }),
  toUpdatePlanPatch: (patch: unknown) => patch,
}))

vi.mock("@/hooks/mediaMetadata/useUpdateMediaMetadataMutation", () => ({
  useUpdateMediaMetadataMutation: () => ({ persistMediaMetadata: vi.fn() }),
}))

vi.mock("@/actions/handleAiRecognizeConfirm", () => ({
  handleAiRecognizeConfirm: h.handleAiRecognizeConfirm,
}))

describe("useAiBasedRecognizeEpisodeFlow", () => {
  const mediaFolderPath = "/storage/Users/currentUser/Download/Anime/show"
  const mediaMetadata = { mediaFolderPath, type: "tvshow-folder" } as MediaMetadata

  const pendingAiPlan: UIRecognizeMediaFilePlan = {
    id: "plan-1",
    task: "recognize-media-file",
    status: "pending",
    creator: "ai",
    mediaFolderPath,
    files: [
      { season: 1, episode: 1, path: `${mediaFolderPath}/S01E01.mkv` },
      { season: 1, episode: 2, path: `${mediaFolderPath}/S01E02.mkv` },
    ],
  }

  it("surfaces pending MCP recognize plans regardless of isAiFeatureEnabled", () => {
    h.plans = [pendingAiPlan]
    const { result } = renderHook(() =>
      useAiBasedRecognizeEpisodeFlow({
        mediaMetadata,
        beforeConfirm: (plan) => plan,
      }),
    )

    expect(result.current.plan?.id).toBe("plan-1")
    expect(result.current.promptStatus).toBeUndefined()
    expect(result.current.promptProps.isOpen).toBe(true)
    expect(result.current.promptProps).not.toHaveProperty("status")
  })

  it("ignores plans of other media folders", () => {
    h.plans = [{ ...pendingAiPlan, mediaFolderPath: "/other/show" }]
    const { result } = renderHook(() =>
      useAiBasedRecognizeEpisodeFlow({
        mediaMetadata,
        beforeConfirm: (plan) => plan,
      }),
    )

    expect(result.current.plan).toBeUndefined()
    expect(result.current.promptProps.isOpen).toBe(false)
  })

  it("passes the beforeConfirm-prepared plan to handleAiRecognizeConfirm", async () => {
    h.plans = [pendingAiPlan]
    const { result } = renderHook(() =>
      useAiBasedRecognizeEpisodeFlow({
        mediaMetadata,
        beforeConfirm: (plan) => ({ ...plan, files: plan.files.slice(0, 1) }),
      }),
    )

    await result.current.onConfirm()

    expect(h.handleAiRecognizeConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ files: [pendingAiPlan.files[0]] }),
      mediaMetadata,
      expect.any(Function),
      expect.any(Function),
    )
  })

  it("rejects the plan on cancel", async () => {
    h.plans = [pendingAiPlan]
    const { result } = renderHook(() =>
      useAiBasedRecognizeEpisodeFlow({
        mediaMetadata,
        beforeConfirm: (plan) => plan,
      }),
    )

    await result.current.onCancel()

    expect(h.updatePlanMutateAsync).toHaveBeenCalledWith({
      id: "plan-1",
      mediaFolderPath,
      patch: { status: "rejected" },
    })
  })
})
