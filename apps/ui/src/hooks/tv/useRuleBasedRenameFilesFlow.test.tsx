import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useRuleBasedRenameFilesFlow } from "./useRuleBasedRenameFilesFlow"
import type { MediaMetadata } from "@smm/types"

const {
  toastErrorMock,
  tryToRenameEpisodesMutationMock,
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
    tryToRenameEpisodesMutationMock: makeMutation(),
    rejectPlanMutationMock: makeMutation(),
    applyPlanMutationMock: makeMutation(),
  }
})

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: vi.fn(),
  },
}))

vi.mock("@/hooks/plans/useTryToRenameEpisodesMutation", () => ({
  useTryToRenameEpisodesMutation: () => tryToRenameEpisodesMutationMock,
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

describe("useRuleBasedRenameFilesFlow", () => {
  const mediaFolderPath = "/storage/Users/currentUser/Download/Anime/show"
  const pendingPlan = {
    id: "plan-1",
    task: "rename-files",
    status: "pending",
    creator: "app",
    mediaFolderPath,
    files: [{ from: `${mediaFolderPath}/S01E01.mkv`, to: `${mediaFolderPath}/plex.mkv` }],
  } as const

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

  const renderFlow = () =>
    renderHook(() => useRuleBasedRenameFilesFlow({ mediaMetadata }), { wrapper })

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    vi.clearAllMocks()
    tryToRenameEpisodesMutationMock.mutateAsync.mockResolvedValue(pendingPlan)
    rejectPlanMutationMock.mutateAsync.mockResolvedValue(null)
    applyPlanMutationMock.mutateAsync.mockResolvedValue(null)
    tryToRenameEpisodesMutationMock.isPending = false
  })

  it("start calls try-to-rename-episodes with the default rule", async () => {
    const { result } = renderFlow()

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(tryToRenameEpisodesMutationMock.mutateAsync).toHaveBeenCalledWith({
        mediaFolderPath,
        rule: "plex",
      })
    })
    expect(rejectPlanMutationMock.mutateAsync).not.toHaveBeenCalled()
    expect(result.current.open).toBe(true)
  })

  it("shows failure toast when try-to-rename-episodes fails", async () => {
    tryToRenameEpisodesMutationMock.mutateAsync.mockRejectedValue(new Error("boom"))

    const { result } = renderFlow()

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Rename failed. Please try again.")
    })
  })

  it("switches naming rule via reject-plan then try-to-rename-episodes", async () => {
    const embyPlan = {
      ...pendingPlan,
      id: "plan-2",
      files: [{ from: `${mediaFolderPath}/S01E01.mkv`, to: `${mediaFolderPath}/emby.mkv` }],
    }
    tryToRenameEpisodesMutationMock.mutateAsync
      .mockResolvedValueOnce(pendingPlan)
      .mockResolvedValueOnce(embyPlan)

    const { result } = renderFlow()

    await act(async () => {
      await result.current.start()
    })

    await act(async () => {
      await result.current.selectNamingRule("emby")
    })

    expect(rejectPlanMutationMock.mutateAsync).toHaveBeenCalledWith({
      id: "plan-1",
      mediaFolderPath,
    })
    expect(tryToRenameEpisodesMutationMock.mutateAsync).toHaveBeenLastCalledWith({
      mediaFolderPath,
      rule: "emby",
    })
    expect(result.current.plan?.id).toBe("plan-2")
  })

  it("confirm calls apply-plan without manual metadata fetch", async () => {
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

  it("Start to rename and then cancel", async () => {
    // Step 1: start — mutation in flight → loading is true, dialog open
    let resolveTryToRename: (plan: typeof pendingPlan) => void = () => {}
    tryToRenameEpisodesMutationMock.mutateAsync.mockImplementation(
      () => new Promise<typeof pendingPlan>((resolve) => { resolveTryToRename = resolve }),
    )
    tryToRenameEpisodesMutationMock.isPending = true

    const { result } = renderFlow()

    act(() => {
      result.current.start()
    })

    expect(result.current.open).toBe(true)
    expect(tryToRenameEpisodesMutationMock.mutateAsync).toHaveBeenCalledWith({
      mediaFolderPath,
      rule: "plex",
    })
    expect(result.current.loading).toBe(true)

    // Step 2: mutation succeeds → loading false, plan assigned
    await act(async () => {
      tryToRenameEpisodesMutationMock.isPending = false
      resolveTryToRename(pendingPlan)
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.plan).toEqual(pendingPlan)

    // Step 3: cancel — dialog closed, pending plan rejected, mutations reset
    await act(async () => {
      await result.current.cancel()
    })

    expect(result.current.open).toBe(false)
    expect(rejectPlanMutationMock.mutateAsync).toHaveBeenCalledWith({
      id: "plan-1",
      mediaFolderPath,
    })
    expect(tryToRenameEpisodesMutationMock.reset).toHaveBeenCalled()
    expect(rejectPlanMutationMock.reset).toHaveBeenCalled()
    expect(applyPlanMutationMock.reset).toHaveBeenCalled()
    expect(result.current.plan).toBeUndefined()
  })

  it("Start to rename, switch naming rule to Emby, then confirm", async () => {
    const embyPlan = {
      ...pendingPlan,
      id: "plan-2",
      files: [{ from: `${mediaFolderPath}/S01E01.mkv`, to: `${mediaFolderPath}/emby.mkv` }],
    }
    tryToRenameEpisodesMutationMock.mutateAsync
      .mockResolvedValueOnce(pendingPlan)
      .mockResolvedValueOnce(embyPlan)

    const { result } = renderFlow()

    await act(async () => {
      await result.current.start()
    })

    await act(async () => {
      await result.current.selectNamingRule("emby")
    })

    expect(result.current.plan?.id).toBe("plan-2")

    await act(async () => {
      await result.current.confirm([`${mediaFolderPath}/S01E01.mkv`])
    })

    expect(rejectPlanMutationMock.mutateAsync).toHaveBeenCalledWith({
      id: "plan-1",
      mediaFolderPath,
    })
    expect(applyPlanMutationMock.mutateAsync).toHaveBeenCalledWith({
      id: "plan-2",
      mediaFolderPath,
      files: [`${mediaFolderPath}/S01E01.mkv`],
    })
    expect(result.current.open).toBe(false)
    expect(result.current.plan).toBeUndefined()
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it("Start to rename but try-to-rename API fails", async () => {
    tryToRenameEpisodesMutationMock.mutateAsync.mockRejectedValue(new Error("boom"))

    const { result } = renderFlow()

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Rename failed. Please try again.")
    })

    expect(result.current.open).toBe(true)
    expect(result.current.plan).toBeUndefined()
    expect(rejectPlanMutationMock.mutateAsync).not.toHaveBeenCalled()
  })

  it("Start to rename and then confirm", async () => {
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

  it("Start to rename, confirm but apply-plan API fails", async () => {
    applyPlanMutationMock.mutateAsync.mockRejectedValue(new Error("boom"))

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
    expect(toastErrorMock).toHaveBeenCalledWith("Rename failed. Please try again.")
    expect(result.current.open).toBe(true)
    expect(result.current.plan).toEqual(pendingPlan)
  })
})
