import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useRuleBasedRenameFilesFlow } from "./useRuleBasedRenameFilesFlow"
import { plansQueryKey } from "@/hooks/plans/plansQueryKeys"
import type { UIRenameFilesPlan } from "@/types/UIRenameFilesPlan"
import type { MediaMetadata } from "@smm/types"

const {
  toastErrorMock,
  tryToRenameEpisodesMock,
  rejectPlanMock,
  applyPlanMock,
  fetchMediaMetadataMock,
} = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  tryToRenameEpisodesMock: vi.fn(),
  rejectPlanMock: vi.fn(),
  applyPlanMock: vi.fn(),
  fetchMediaMetadataMock: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: vi.fn(),
  },
}))

vi.mock("@/api/tryToRenameEpisodes", () => ({
  tryToRenameEpisodes: (...args: unknown[]) => tryToRenameEpisodesMock(...args),
}))

vi.mock("@/api/rejectPlan", () => ({
  rejectPlan: (...args: unknown[]) => rejectPlanMock(...args),
}))

vi.mock("@/api/applyPlan", () => ({
  applyPlan: (...args: unknown[]) => applyPlanMock(...args),
}))

vi.mock("@/hooks/mediaMetadata/useFetchMediaMetadataMutation", () => ({
  useFetchMediaMetadataMutation: () => ({
    mutateAsync: fetchMediaMetadataMock,
  }),
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}))

describe("useRuleBasedRenameFilesFlow", () => {
  const mediaFolderPath = "/storage/Users/currentUser/Download/Anime/show"
  const pendingPlan: UIRenameFilesPlan = {
    id: "plan-1",
    task: "rename-files",
    status: "pending",
    creator: "app",
    mediaFolderPath,
    files: [{ from: `${mediaFolderPath}/S01E01.mkv`, to: `${mediaFolderPath}/plex.mkv` }],
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
    tryToRenameEpisodesMock.mockResolvedValue({ data: { plan: pendingPlan } })
    rejectPlanMock.mockResolvedValue({ data: { plan: { ...pendingPlan, status: "rejected" } } })
    applyPlanMock.mockResolvedValue({ data: { id: pendingPlan.id } })
    fetchMediaMetadataMock.mockResolvedValue(mediaMetadata)
  })

  it("startRenameFlow calls try-to-rename-episodes with the default rule", async () => {
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

    act(() => {
      result.current.startRenameFlow()
    })

    await waitFor(() => {
      expect(tryToRenameEpisodesMock).toHaveBeenCalledWith({
        mediaFolderPath,
        rule: "plex",
      })
    })
    expect(rejectPlanMock).not.toHaveBeenCalled()
  })

  it("shows failure toast when try-to-rename-episodes fails", async () => {
    tryToRenameEpisodesMock.mockResolvedValue({ error: "Error Reason: boom" })

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

    act(() => {
      result.current.startRenameFlow()
    })

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Error Reason: boom")
    })
  })

  it("switches naming rule via reject-plan then try-to-rename-episodes", async () => {
    const embyPlan: UIRenameFilesPlan = {
      ...pendingPlan,
      id: "plan-2",
      files: [{ from: `${mediaFolderPath}/S01E01.mkv`, to: `${mediaFolderPath}/emby.mkv` }],
    }
    queryClient.setQueryData(plansQueryKey(mediaFolderPath), [pendingPlan])
    tryToRenameEpisodesMock.mockResolvedValue({ data: { plan: embyPlan } })

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

    await act(async () => {
      await result.current.onNamingRuleSelected("emby")
    })

    expect(rejectPlanMock).toHaveBeenCalledWith({ id: "plan-1" })
    expect(tryToRenameEpisodesMock).toHaveBeenCalledWith({
      mediaFolderPath,
      rule: "emby",
    })
  })

  it("confirm calls apply-plan and refreshes media metadata", async () => {
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

    await act(async () => {
      await result.current.onConfirm("plan-1")
    })

    expect(applyPlanMock).toHaveBeenCalledWith({ id: "plan-1" })
    expect(fetchMediaMetadataMock).toHaveBeenCalledWith({ path: mediaFolderPath })
  })

  it("cancel calls reject-plan", async () => {
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

    await act(async () => {
      await result.current.onCancel("plan-1")
    })

    expect(rejectPlanMock).toHaveBeenCalledWith({ id: "plan-1" })
  })
})
