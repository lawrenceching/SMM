import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useRuleBasedRecognizeFlow } from "./useRuleBasedRecognizeFlow"
import type { MediaMetadata } from "@smm/types"
import type { RecognizeMediaFilePlan } from "@smm/types/RecognizeMediaFilePlan"

const {
  toastErrorMock,
  toastSuccessMock,
  tryToRecognizeMutationMock,
  rejectPlanMutationMock,
  applyPlanMutationMock,
} = vi.hoisted(() => {
  const makeMutation = () => ({
    mutateAsync: vi.fn(),
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
  })
  return {
    toastErrorMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    tryToRecognizeMutationMock: makeMutation(),
    rejectPlanMutationMock: makeMutation(),
    applyPlanMutationMock: makeMutation(),
  }
})

vi.mock("sonner", () => ({
  toast: { error: toastErrorMock, success: toastSuccessMock },
}))

vi.mock("@/hooks/plans/useTryToRecognizeEpisodesMutation", () => ({
  useTryToRecognizeEpisodesMutation: () => tryToRecognizeMutationMock,
}))

vi.mock("@/hooks/plans/useRejectPlanMutation", () => ({
  useRejectPlanMutation: () => rejectPlanMutationMock,
}))

vi.mock("@/hooks/plans/useApplyPlanMutation", () => ({
  useApplyPlanMutation: () => applyPlanMutationMock,
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}))

describe("useRuleBasedRecognizeFlow", () => {
  const mediaFolderPath = "/storage/Users/currentUser/Download/Anime/show"
  const pendingPlan: RecognizeMediaFilePlan = {
    id: "plan-1",
    task: "recognize-media-file",
    status: "pending",
    creator: "app",
    mediaFolderPath,
    files: [
      { season: 1, episode: 1, path: `${mediaFolderPath}/S01E01.mkv` },
      { season: 1, episode: 2, path: `${mediaFolderPath}/S01E02.mkv` },
    ],
  }

  const mediaMetadata = {
    mediaFolderPath,
    type: "tvshow-folder",
    tvShow: {
      id: "123",
      name: "Test Show",
      seasons: [
        {
          season: 1,
          name: "Season 1",
          episodes: [
            { episode: 1, name: "E1" },
            { episode: 2, name: "E2" },
          ],
        },
      ],
    },
    mediaFiles: [{ absolutePath: `${mediaFolderPath}/S01E01.mkv`, seasonNumber: 1, episodeNumber: 1 }],
  } as unknown as MediaMetadata

  let queryClient: QueryClient

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  const renderFlow = () =>
    renderHook(() => useRuleBasedRecognizeFlow({ mediaMetadata }), { wrapper })

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    vi.clearAllMocks()
    tryToRecognizeMutationMock.mutateAsync.mockResolvedValue(pendingPlan)
    rejectPlanMutationMock.mutateAsync.mockResolvedValue(null)
    applyPlanMutationMock.mutateAsync.mockResolvedValue(null)
    tryToRecognizeMutationMock.isPending = false
  })

  it("Start to recognize: open=true, mutation called, loading=true while pending", async () => {
    let resolveTryToRecognize: (plan: RecognizeMediaFilePlan) => void = () => {}
    tryToRecognizeMutationMock.mutateAsync.mockImplementation(
      () =>
        new Promise<RecognizeMediaFilePlan>((resolve) => {
          resolveTryToRecognize = resolve
        }),
    )
    tryToRecognizeMutationMock.isPending = true

    const { result } = renderFlow()

    act(() => {
      result.current.start()
    })

    expect(result.current.open).toBe(true)
    expect(tryToRecognizeMutationMock.mutateAsync).toHaveBeenCalledWith({ mediaFolderPath })
    expect(result.current.loading).toBe(true)

    await act(async () => {
      tryToRecognizeMutationMock.isPending = false
      resolveTryToRecognize(pendingPlan)
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.plan).toEqual(pendingPlan)
  })

  it("Start to recognize and then cancel", async () => {
    const { result } = renderFlow()

    await act(async () => {
      await result.current.start()
    })

    await act(async () => {
      await result.current.cancel()
    })

    expect(result.current.open).toBe(false)
    expect(rejectPlanMutationMock.mutateAsync).toHaveBeenCalledWith({
      id: "plan-1",
      mediaFolderPath,
    })
    expect(tryToRecognizeMutationMock.reset).toHaveBeenCalled()
    expect(rejectPlanMutationMock.reset).toHaveBeenCalled()
    expect(applyPlanMutationMock.reset).toHaveBeenCalled()
    expect(result.current.plan).toBeUndefined()
  })

  it("Start to recognize and then confirm without selection", async () => {
    const { result } = renderFlow()

    await act(async () => {
      await result.current.start()
    })

    await act(async () => {
      await result.current.confirm()
    })

    expect(applyPlanMutationMock.mutateAsync).toHaveBeenCalledWith({
      id: "plan-1",
      mediaFolderPath,
      files: undefined,
    })
    expect(result.current.open).toBe(false)
    expect(result.current.plan).toBeUndefined()
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it("Confirm with selected files passes them to apply-plan", async () => {
    const { result } = renderFlow()

    await act(async () => {
      await result.current.start()
    })

    await act(async () => {
      await result.current.confirm([`${mediaFolderPath}/S01E01.mkv`])
    })

    expect(applyPlanMutationMock.mutateAsync).toHaveBeenCalledWith({
      id: "plan-1",
      mediaFolderPath,
      files: [`${mediaFolderPath}/S01E01.mkv`],
    })
    expect(result.current.open).toBe(false)
  })

  it("Confirm failure keeps the prompt open and toasts", async () => {
    applyPlanMutationMock.mutateAsync.mockRejectedValue(new Error("boom"))

    const { result } = renderFlow()

    await act(async () => {
      await result.current.start()
    })

    await act(async () => {
      await result.current.confirm()
    })

    expect(toastErrorMock).toHaveBeenCalledWith("Recognition failed. Please try again.")
    expect(result.current.open).toBe(true)
    expect(result.current.plan).toEqual(pendingPlan)
  })

  it("Empty recognition result: prompt closed, no-recognized-files toast, plan rejected", async () => {
    tryToRecognizeMutationMock.mutateAsync.mockResolvedValue({
      ...pendingPlan,
      files: [],
    })

    const { result } = renderFlow()

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Unable to recognize any episodes. Consider using AI to recognize instead.",
      )
    })
    expect(rejectPlanMutationMock.mutateAsync).toHaveBeenCalledWith({
      id: "plan-1",
      mediaFolderPath,
    })
    expect(result.current.open).toBe(false)
    expect(result.current.plan).toBeUndefined()
  })

  it("Start failure: toast and prompt closed", async () => {
    tryToRecognizeMutationMock.mutateAsync.mockRejectedValue(new Error("boom"))

    const { result } = renderFlow()

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Recognition failed. Please try again.")
    })
    expect(result.current.open).toBe(false)
    expect(result.current.plan).toBeUndefined()
  })

  describe("isConfirmButtonDisabled", () => {
    it("is false when idle with no plan", () => {
      const { result } = renderFlow()
      expect(result.current.isConfirmButtonDisabled).toBe(false)
    })

    it("is true while try-to-recognize is pending", async () => {
      let resolveTryToRecognize: (plan: RecognizeMediaFilePlan) => void = () => {}
      tryToRecognizeMutationMock.mutateAsync.mockImplementation(
        () =>
          new Promise<RecognizeMediaFilePlan>((resolve) => {
            resolveTryToRecognize = resolve
          }),
      )
      tryToRecognizeMutationMock.isPending = true

      const { result } = renderFlow()

      act(() => {
        result.current.start()
      })

      expect(result.current.isConfirmButtonDisabled).toBe(true)

      await act(async () => {
        tryToRecognizeMutationMock.isPending = false
        resolveTryToRecognize(pendingPlan)
      })

      expect(result.current.isConfirmButtonDisabled).toBe(false)
    })

    it("is false when plan has files that still need applying", async () => {
      const { result } = renderFlow()

      await act(async () => {
        await result.current.start()
      })

      expect(result.current.allPlanFilesUnchanged).toBe(false)
      expect(result.current.isConfirmButtonDisabled).toBe(false)
    })

    it("is true when every plan file already matches mediaFiles", async () => {
      const unchangedPlan: RecognizeMediaFilePlan = {
        ...pendingPlan,
        files: [
          { season: 1, episode: 1, path: `${mediaFolderPath}/S01E01.mkv` },
        ],
      }
      tryToRecognizeMutationMock.mutateAsync.mockResolvedValue(unchangedPlan)

      const { result } = renderFlow()

      await act(async () => {
        await result.current.start()
      })

      expect(result.current.allPlanFilesUnchanged).toBe(true)
      expect(result.current.isConfirmButtonDisabled).toBe(true)
    })
  })
})
