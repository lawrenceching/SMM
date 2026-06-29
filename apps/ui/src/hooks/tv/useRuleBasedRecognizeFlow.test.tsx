import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useRuleBasedRecognizeFlow } from "./useRuleBasedRecognizeFlow"
import { buildTemporaryRecognitionPlanAsync } from "@/components/tv/TvShowPanelUtils"
import { plansQueryKey } from "@/hooks/plans/plansQueryKeys"
import type { UIRecognizeMediaFilePlan } from "@/types/UIRecognizeMediaFilePlan"
import type { MediaMetadata } from "@core/types"

const { toastErrorMock, createPlanOptimisticMock, updatePlanMutateAsyncMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  createPlanOptimisticMock: vi.fn(),
  updatePlanMutateAsyncMock: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: vi.fn(),
  },
}))

vi.mock("@/components/tv/TvShowPanelUtils", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/components/tv/TvShowPanelUtils")>()
  return {
    ...mod,
    buildTemporaryRecognitionPlanAsync: vi.fn(),
  }
})

vi.mock("@/hooks/plans", () => ({
  useCreatePlanMutation: () => ({
    createPlanOptimistic: createPlanOptimisticMock,
  }),
  useUpdatePlanMutation: () => ({
    mutateAsync: updatePlanMutateAsyncMock,
  }),
  toUpdatePlanPatch: (patch: unknown) => patch,
}))

vi.mock("@/hooks/mediaMetadata/useUpdateMediaMetadataMutation", () => ({
  useUpdateMediaMetadataMutation: () => ({ persistMediaMetadata: vi.fn() }),
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}))

describe("useRuleBasedRecognizeFlow", () => {
  const mediaFolderPath = "/storage/Users/currentUser/Download/Anime/show"
  const preparingPlan: UIRecognizeMediaFilePlan = {
    id: "plan-1",
    task: "recognize-media-file",
    status: "preparing",
    creator: "app",
    mediaFolderPath,
    files: [],
  }

  const mediaMetadata = {
    mediaFolderPath,
    type: "tvshow-folder",
    tvShow: { id: "123", name: "Test Show" },
    files: ["S01E01.mkv"],
  } as MediaMetadata

  let queryClient: QueryClient

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    vi.clearAllMocks()
    createPlanOptimisticMock.mockResolvedValue(preparingPlan)
    updatePlanMutateAsyncMock.mockResolvedValue(null)
  })

  it("shows failure toast and rejects plan when recognition computation throws", async () => {
    queryClient.setQueryData(plansQueryKey(mediaFolderPath), [preparingPlan])
    vi.mocked(buildTemporaryRecognitionPlanAsync).mockRejectedValue(
      new Error("lookup crashed"),
    )

    renderHook(
      () =>
        useRuleBasedRecognizeFlow({
          plans: [preparingPlan],
          mediaMetadata,
          uiStatus: "ok",
          beforeConfirm: (plan) => plan,
        }),
      { wrapper },
    )

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("lookup crashed")
    })

    expect(updatePlanMutateAsyncMock).toHaveBeenCalledWith({
      id: "plan-1",
      mediaFolderPath,
      patch: { status: "rejected" },
    })
  })

  it("shows failure toast and rejects plan when no episodes are recognized", async () => {
    queryClient.setQueryData(plansQueryKey(mediaFolderPath), [preparingPlan])
    vi.mocked(buildTemporaryRecognitionPlanAsync).mockResolvedValue({
      mediaFolderPath,
      files: [],
    })

    renderHook(
      () =>
        useRuleBasedRecognizeFlow({
          plans: [preparingPlan],
          mediaMetadata,
          uiStatus: "ok",
          beforeConfirm: (plan) => plan,
        }),
      { wrapper },
    )

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Unable to recognize any episodes. Consider using AI to recognize instead.",
      )
    })

    expect(updatePlanMutateAsyncMock).toHaveBeenCalledWith({
      id: "plan-1",
      mediaFolderPath,
      patch: { status: "rejected" },
    })
  })

  it("shows failure toast when createPlan fails during startRecognizeFlow", async () => {
    createPlanOptimisticMock.mockRejectedValue(new Error("create plan failed"))

    const { result } = renderHook(
      () =>
        useRuleBasedRecognizeFlow({
          plans: [],
          mediaMetadata,
          uiStatus: "ok",
          beforeConfirm: (plan) => plan,
        }),
      { wrapper },
    )

    result.current.startRecognizeFlow()

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("create plan failed")
    })
  })

  it("fails preparing plan when metadata loading errors", async () => {
    queryClient.setQueryData(plansQueryKey(mediaFolderPath), [preparingPlan])

    renderHook(
      () =>
        useRuleBasedRecognizeFlow({
          plans: [preparingPlan],
          mediaMetadata,
          uiStatus: "error_loading_metadata",
          beforeConfirm: (plan) => plan,
        }),
      { wrapper },
    )

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Recognition failed. Please try again.")
    })

    expect(updatePlanMutateAsyncMock).toHaveBeenCalledWith({
      id: "plan-1",
      mediaFolderPath,
      patch: { status: "rejected" },
    })
  })
})
