import { describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useAiBasedRecognizeFlow } from "./useAiBasedRecognizeFlow"
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan"
import type { MediaMetadata } from "@core/types"

vi.mock("@/hooks/plans", () => ({
  useUpdatePlanMutation: () => ({ mutateAsync: vi.fn() }),
  toUpdatePlanPatch: (patch: unknown) => patch,
}))

vi.mock("@/hooks/mediaMetadata/useUpdateMediaMetadataMutation", () => ({
  useUpdateMediaMetadataMutation: () => ({ persistMediaMetadata: vi.fn() }),
}))

vi.mock("@/actions/handleAiRecognizeConfirm", () => ({
  handleAiRecognizeConfirm: vi.fn(),
}))

vi.mock("@/ai/tools/EndRecognizeTask", () => ({
  cleanupRecognizePlan: vi.fn(),
}))

describe("useAiBasedRecognizeFlow", () => {
  const mediaFolderPath = "/storage/Users/currentUser/Download/Anime/show"
  const pendingAiPlan: UIRecognizeMediaFilePlan = {
    id: "plan-1",
    task: "recognize-media-file",
    status: "pending",
    creator: "ai",
    mediaFolderPath,
    files: [{ season: 1, episode: 1, path: `${mediaFolderPath}/S01E01.mkv` }],
  }

  const mediaMetadata = {
    mediaFolderPath,
    type: "tvshow-folder",
  } as MediaMetadata

  it("surfaces pending MCP recognize plans regardless of isAiFeatureEnabled", () => {
    const { result } = renderHook(() =>
      useAiBasedRecognizeFlow({
        plans: [pendingAiPlan],
        mediaMetadata,
        beforeConfirm: (plan) => plan,
      }),
    )

    expect(result.current.plan?.id).toBe("plan-1")
    expect(result.current.promptStatus).toBe("wait-for-ack")
  })
})
