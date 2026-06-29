import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useRuleBasedRenameFilesFlow } from "./useRuleBasedRenameFilesFlow"
import { plansQueryKey } from "@/hooks/plans/plansQueryKeys"
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan"
import type { MediaMetadata } from "@core/types"

const { toastErrorMock, createPlanOptimisticMock, updatePlanMutateAsyncMock, generateNewFileNamesMock } =
  vi.hoisted(() => ({
    toastErrorMock: vi.fn(),
    createPlanOptimisticMock: vi.fn(),
    updatePlanMutateAsyncMock: vi.fn(),
    generateNewFileNamesMock: vi.fn(),
  }))

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: vi.fn(),
  },
}))

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

vi.mock("@/actions/handleRenamePromptConfirmForTvShow", () => ({
  handleRenamePromptConfirmForTvShow: vi.fn(),
}))

vi.mock("./useTvShowFileNameGeneration", () => ({
  useTvShowFileNameGeneration: () => ({
    generateNewFileNames: generateNewFileNamesMock,
  }),
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}))

describe("useRuleBasedRenameFilesFlow", () => {
  const mediaFolderPath = "/storage/Users/currentUser/Download/Anime/show"
  const preparingPlan: UIRenameFilesPlan = {
    id: "plan-1",
    task: "rename-files",
    status: "preparing",
    creator: "app",
    mediaFolderPath,
    files: [],
  }

  const mediaMetadata = {
    mediaFolderPath,
    type: "tvshow-folder",
    tvShow: { id: "123", name: "Test Show", seasons: [] },
    files: ["S01E01.mkv"],
    mediaFiles: [{ absolutePath: `${mediaFolderPath}/S01E01.mkv`, seasonNumber: 1, episodeNumber: 1 }],
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
    generateNewFileNamesMock.mockReturnValue({
      id: "generated",
      task: "rename-files",
      status: "pending",
      creator: "app",
      mediaFolderPath,
      files: [{ from: `${mediaFolderPath}/S01E01.mkv`, to: `${mediaFolderPath}/S01E01 - Episode.mkv` }],
    })
  })

  it("shows failure toast and rejects plan when no rename files are generated", async () => {
    queryClient.setQueryData(plansQueryKey(mediaFolderPath), [preparingPlan])
    generateNewFileNamesMock.mockReturnValue(null)

    renderHook(
      () =>
        useRuleBasedRenameFilesFlow({
          plans: [preparingPlan],
          mediaMetadata,
          uiStatus: "ok",
          beforeConfirm: (plan) => plan,
        }),
      { wrapper },
    )

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Unable to generate a rename plan. Check that episodes have video files.",
      )
    })

    expect(updatePlanMutateAsyncMock).toHaveBeenCalledWith({
      id: "plan-1",
      mediaFolderPath,
      patch: { status: "rejected" },
    })
  })

  it("shows failure toast when createPlan fails during startRenameFlow", async () => {
    createPlanOptimisticMock.mockRejectedValue(new Error("create plan failed"))

    const { result } = renderHook(
      () =>
        useRuleBasedRenameFilesFlow({
          plans: [],
          mediaMetadata,
          uiStatus: "ok",
          beforeConfirm: (plan) => plan,
        }),
      { wrapper },
    )

    result.current.startRenameFlow()

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("create plan failed")
    })
  })

  it("fails preparing plan when metadata loading errors", async () => {
    queryClient.setQueryData(plansQueryKey(mediaFolderPath), [preparingPlan])

    renderHook(
      () =>
        useRuleBasedRenameFilesFlow({
          plans: [preparingPlan],
          mediaMetadata,
          uiStatus: "error_loading_metadata",
          beforeConfirm: (plan) => plan,
        }),
      { wrapper },
    )

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Rename failed. Please try again.")
    })

    expect(updatePlanMutateAsyncMock).toHaveBeenCalledWith({
      id: "plan-1",
      mediaFolderPath,
      patch: { status: "rejected" },
    })
  })

  it("updates plan to pending when rename files are generated on first prompt open", async () => {
    queryClient.setQueryData(plansQueryKey(mediaFolderPath), [preparingPlan])

    renderHook(
      () =>
        useRuleBasedRenameFilesFlow({
          plans: [preparingPlan],
          mediaMetadata,
          uiStatus: "ok",
          beforeConfirm: (plan) => plan,
        }),
      { wrapper },
    )

    await waitFor(() => {
      expect(updatePlanMutateAsyncMock).toHaveBeenCalledWith({
        id: "plan-1",
        mediaFolderPath,
        patch: {
          status: "pending",
          files: [
            {
              from: `${mediaFolderPath}/S01E01.mkv`,
              to: `${mediaFolderPath}/S01E01 - Episode.mkv`,
            },
          ],
        },
      })
    })
  })

  it("startRenameFlow only creates plan and does not generate preview", async () => {
    const { result } = renderHook(
      () =>
        useRuleBasedRenameFilesFlow({
          plans: [],
          mediaMetadata,
          uiStatus: "ok",
          beforeConfirm: (plan) => plan,
        }),
      { wrapper },
    )

    result.current.startRenameFlow()

    await waitFor(() => {
      expect(createPlanOptimisticMock).toHaveBeenCalled()
    })

    expect(updatePlanMutateAsyncMock).not.toHaveBeenCalled()
    expect(generateNewFileNamesMock).not.toHaveBeenCalled()
  })

  it("regenerates preview when user selects a different naming rule", async () => {
    const pendingPlan: UIRenameFilesPlan = {
      ...preparingPlan,
      status: "pending",
      files: [{ from: `${mediaFolderPath}/S01E01.mkv`, to: `${mediaFolderPath}/plex.mkv` }],
    }
    queryClient.setQueryData(plansQueryKey(mediaFolderPath), [pendingPlan])

    const { result } = renderHook(
      () =>
        useRuleBasedRenameFilesFlow({
          plans: [pendingPlan],
          mediaMetadata,
          uiStatus: "ok",
          beforeConfirm: (plan) => plan,
        }),
      { wrapper },
    )

    updatePlanMutateAsyncMock.mockClear()
    generateNewFileNamesMock.mockReturnValue({
      id: "generated",
      task: "rename-files",
      status: "pending",
      creator: "app",
      mediaFolderPath,
      files: [{ from: `${mediaFolderPath}/S01E01.mkv`, to: `${mediaFolderPath}/emby.mkv` }],
    })

    await result.current.onNamingRuleSelected("emby")

    expect(generateNewFileNamesMock).toHaveBeenCalledWith("emby")
    expect(updatePlanMutateAsyncMock).toHaveBeenCalledWith({
      id: "plan-1",
      mediaFolderPath,
      patch: {
        status: "pending",
        files: [{ from: `${mediaFolderPath}/S01E01.mkv`, to: `${mediaFolderPath}/emby.mkv` }],
      },
    })
  })
})
